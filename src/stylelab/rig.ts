// Motion Lab rig: splits each Style Lab mount into layers (sprites rendered once per skin) that are
// posed every frame with 2D affine transforms, so any skin animates at 60fps. Only the cookie cape
// truly deforms; it gets a small cross-faded frame loop. Eagle wings are an exact affine (scale+tilt).
import { type Part, type Pt, TAU, bbox } from './geo';
import { LAB_MOUNTS } from './mounts';
import { pixelate, type LabStyle } from './styles';

export type LayerDef = {
  id: string;
  parts: string[];          // part ids (a trailing * matches a prefix)
  pivot: Pt;                // in 512-unit mount space
  parent?: string;          // pose is relative to this layer's pose
  frames?: number;          // deforming layer: N frames over the mount's phase 0..2PI
  phase?: number;           // fixed phase to render a rigid layer at
};
export type Rig = { mount: number; center: Pt; layers: LayerDef[] };

export const RIGS: Rig[] = [
  { mount: 0, center: [262, 300], layers: [
    { id: 'cape', parts: ['cape', 'cape-lining', 'cape-trim'], pivot: [214, 196], parent: 'body', frames: 24 },
    { id: 'armB', parts: ['arm-back'], pivot: [168, 302], parent: 'body' },
    { id: 'legL', parts: ['leg-l'], pivot: [236, 380], parent: 'body' },
    { id: 'legR', parts: ['leg-r'], pivot: [298, 382], parent: 'body' },
    { id: 'body', parts: ['body', 'chip*', 'blush-l', 'blush-r', 'smile'], pivot: [266, 396] },
    { id: 'eyes', parts: ['eye-l', 'eye-r', 'glint-l', 'glint-r'], pivot: [270, 286], parent: 'body' },
    { id: 'armF', parts: ['arm-front'], pivot: [374, 298], parent: 'body' },
    { id: 'knot', parts: ['knot'], pivot: [214, 196], parent: 'body' },
    { id: 'hat', parts: ['crown', 'dent', 'band', 'brim'], pivot: [276, 186], parent: 'body' },
  ] },
  { mount: 1, center: [262, 292], layers: [
    { id: 'farWing', parts: ['far-wing'], pivot: [262, 258], parent: 'body', phase: 0.25 },
    { id: 'tail', parts: ['tail', 'tail-l1', 'tail-l2'], pivot: [168, 306], parent: 'body' },
    { id: 'talons', parts: ['talon-1', 'talon-2'], pivot: [282, 334], parent: 'body' },
    { id: 'body', parts: ['body'], pivot: [262, 344] },
    { id: 'head', parts: ['head', 'beak', 'beak-line', 'brow'], pivot: [334, 270], parent: 'body' },
    { id: 'eye', parts: ['iris', 'eye', 'glint'], pivot: [392, 230], parent: 'head' },
    { id: 'nearWing', parts: ['near-wing', 'covert', 'feather*'], pivot: [290, 270], parent: 'body', phase: 0 },
  ] },
];

export type Sprite = { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number };
export type LayerSprites = { def: LayerDef; frames: (Sprite | undefined)[] };

const match = (ids: string[], id: string) => ids.some((m) => (m.endsWith('*') ? id.startsWith(m.slice(0, -1)) : m === id));
const PAD = 46;

function renderParts(style: LabStyle, parts: Part[], box: { x0: number; y0: number; x1: number; y1: number }, R: number): Sprite {
  const x = box.x0 - PAD, y = box.y0 - PAD, w = box.x1 - box.x0 + PAD * 2, h = box.y1 - box.y0 + PAD * 2;
  const cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.ceil(w * R)); cv.height = Math.max(2, Math.ceil(h * R));
  const c = cv.getContext('2d')!;
  c.setTransform(R, 0, 0, R, -x * R, -y * R);
  style.render(c, parts);
  if (style.pixel) pixelate(cv);
  return { cv, x, y, w: cv.width / R, h: cv.height / R };
}

/** Build a job list that renders every layer sprite for a rig; run the jobs progressively. */
export function rigJobs(rig: Rig, style: LabStyle, R: number, out: LayerSprites[]): [(() => void)[], (() => void)[]] {
  const art = LAB_MOUNTS[rig.mount];
  const first: (() => void)[] = [], later: (() => void)[] = [];
  for (const def of rig.layers) {
    const ls: LayerSprites = { def, frames: [] };
    out.push(ls);
    if (def.frames) {
      const n = def.frames;
      const all = Array.from({ length: n }, (_, i) => art.parts((i / n) * TAU).filter((p) => match(def.parts, p.id)));
      const box = bbox(all.flat().flatMap((p) => p.pts));
      for (let i = 0; i < n; i++) (i === 0 ? first : later).push(() => { ls.frames[i] = renderParts(style, all[i], box, R); });
    } else {
      first.push(() => {
        const parts = art.parts(def.phase ?? 0).filter((p) => match(def.parts, p.id));
        ls.frames[0] = renderParts(style, parts, bbox(parts.flatMap((p) => p.pts)), R);
      });
    }
  }
  return [first, later];
}
