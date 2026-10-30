// Mount Style Lab (temporary): the Cowboy Cookie (with a cape, not wings) and the Bald Eagle,
// described as ordered parts in a 512x512 space. phase (0..2PI) drives cape flutter / wing beat.
import { type MountArt, type Part, type Pt, ellipse, capsule, rotAbout, scaleAbout, shift } from './geo';

const P = (id: string, pts: Pt[], color: string, role: Part['role'] = 'major', extra: Partial<Part> = {}): Part => ({ id, pts, color, role, ...extra });
const L = (id: string, pts: Pt[], color: string, width: number, extra: Partial<Part> = {}): Part => ({ id, pts, color, role: 'line', closed: false, width, ...extra });

// ------------------------------------------------------------------ Cowboy Cookie
const DOUGH = '#d9944b', LIMB = '#c27a38', CHIP = '#4a2914', CAPE = '#cf3b2e', TRIM = '#f0bf4c', FELT = '#8d939b', BAND = '#5a3b2a';
const BODY = ellipse(266, 282, 118, 114, 22, 0, 0.07, 'cookie-body');
const CHIPS: [number, number, number][] = [[200, 240, 15], [262, 196, 12], [330, 226, 14], [352, 296, 12], [196, 336, 16], [270, 356, 13], [330, 350, 10], [226, 290, 9]];

function cookie(ph: number): Part[] {
  const w = (k: number, amp: number) => Math.sin(ph - k * 0.85) * amp;
  // Cape tied at the top of the cookie, streaming back (left) and rippling in the wind.
  const cape: Pt[] = [
    [318, 200], [260, 178], [205, 186],
    [150, 172 + w(1, 6)], [96, 168 + w(2, 11)], [44, 178 + w(3, 17)], [10, 206 + w(4, 22)],
    [22, 246 + w(4.6, 24)], [8, 284 + w(5.2, 26)], [52, 300 + w(5.8, 22)], [80, 326 + w(6.4, 18)],
    [130, 330 + w(7, 13)], [176, 344 + w(7.6, 8)], [222, 322], [300, 280],
  ];
  const capeIn: Pt[] = [[205, 192], [150, 184 + w(1, 6)], [100, 184 + w(2, 11)], [60, 196 + w(3, 17)], [40, 220 + w(4, 20)], [70, 214 + w(3.4, 16)], [120, 206 + w(2.2, 10)], [170, 204 + w(1.2, 6)]];
  const trim: Pt[] = cape.slice(6, 13);
  const hat = (pts: Pt[]) => rotAbout(pts, 276, 160, -0.13);
  const crown = hat([[214, 168], [218, 124], [230, 96], [254, 100], [276, 114], [298, 98], [322, 92], [334, 120], [338, 168]]);
  const band = hat([[215, 146], [276, 152], [337, 146], [338, 168], [276, 172], [214, 168]]);
  const brim = hat([[146, 146], [170, 168], [220, 178], [276, 182], [332, 178], [382, 164], [410, 136], [416, 154], [392, 186], [334, 202], [276, 207], [218, 202], [168, 190], [140, 164]]);
  const dent = hat([[250, 112], [276, 124], [302, 108]]);
  const chips: Part[] = CHIPS.map(([x, y, r], i) => P(`chip${i}`, ellipse(x, y, r, r * 0.85, 9, i, 0.35, `chip${i}`), CHIP, 'minor'));
  const bob = Math.sin(ph) * 3;
  return [
    P('cape', cape, CAPE, 'major', { accent: true }),
    P('cape-lining', capeIn, '#8f2420', 'minor', { accent: true }),
    L('cape-trim', trim, TRIM, 7, { accent: true }),
    P('arm-back', capsule(170, 300, 132, 330 + bob, 15), LIMB),
    P('leg-l', ellipse(232, 392, 20, 15, 14, 0.2), LIMB),
    P('leg-r', ellipse(300, 394, 20, 15, 14, -0.2), LIMB),
    P('body', BODY, DOUGH),
    ...chips,
    P('blush-l', ellipse(220, 318, 17, 10, 14), '#f08a7e', 'blush'),
    P('blush-r', ellipse(318, 318, 17, 10, 14), '#f08a7e', 'blush'),
    P('eye-l', ellipse(242, 286, 11, 15, 14), '#24150c', 'eye'),
    P('eye-r', ellipse(298, 286, 11, 15, 14), '#24150c', 'eye'),
    P('glint-l', ellipse(246, 280, 4, 5, 10), '#ffffff', 'glint'),
    P('glint-r', ellipse(302, 280, 4, 5, 10), '#ffffff', 'glint'),
    L('smile', [[248, 314], [270, 328], [292, 314]], '#3a1f10', 6),
    P('arm-front', capsule(372, 296, 414, 258 - bob, 15), LIMB),
    P('knot', ellipse(214, 196, 15, 12, 12, 0.4), CAPE, 'minor', { accent: true }),
    P('crown', crown, FELT),
    L('dent', dent, '#5f646b', 5, { smooth: true }),
    P('band', band, BAND, 'minor', { smooth: false }),
    P('brim', brim, FELT),
  ];
}

// ------------------------------------------------------------------ Bald Eagle
const BROWN = '#5c3a21', WING = '#4b301c', COVERT = '#6e4628', WHITE = '#f3efe6', GOLD = '#f2b632';
// Near wing in pivot-local coordinates, pointing up and back (fully raised).
const WING_PTS: Pt[] = [
  [38, 6], [42, -40], [22, -110], [-14, -172], [-40, -214], [-56, -216], [-60, -196], [-76, -202], [-80, -180],
  [-98, -182], [-94, -160], [-114, -158], [-104, -130], [-120, -118], [-98, -92], [-84, -52], [-62, -12], [-30, 10], [0, 16],
];
const FEATHERS: Pt[][] = [[[-30, -150], [-48, -206]], [[-50, -140], [-70, -190]], [[-66, -126], [-90, -170]], [[-78, -108], [-108, -146]], [[-80, -86], [-108, -116]]];

function wing(px: number, py: number, s: number, k: number, ph: number): { outer: Pt[]; covert: Pt[]; lines: Pt[][] } {
  const sy = 0.12 + 0.88 * s; // 1 = raised, ~-0.76 = fully down
  const sx = 0.92 + 0.08 * Math.abs(s);
  const tilt = Math.sin(ph) * 0.06;
  const f = (pts: Pt[]) => rotAbout(pts.map(([x, y]) => [px + x * sx * k, py + y * sy * k] as Pt), px, py, tilt);
  return {
    outer: f(WING_PTS),
    covert: f(scaleAbout(WING_PTS, 0, 0, 0.58).map(([x, y]) => [x + 6, y + 4] as Pt)),
    lines: FEATHERS.map(f),
  };
}

function eagle(ph: number): Part[] {
  const s = Math.cos(ph);
  const near = wing(290, 270, s, 1, ph);
  const far = wing(262, 258, Math.cos(ph - 0.25), 0.84, ph);
  const body: Pt[] = [[322, 244], [356, 268], [352, 306], [312, 336], [250, 346], [194, 336], [160, 314], [166, 290], [214, 262], [270, 248]];
  const tail: Pt[] = [[168, 294], [112, 270], [72, 278], [56, 302], [72, 328], [114, 334], [168, 318]];
  const head: Pt[] = [[338, 212], [372, 196], [406, 208], [422, 234], [412, 262], [382, 276], [346, 282], [318, 266]];
  const beak: Pt[] = [[404, 220], [440, 224], [462, 244], [456, 264], [444, 252], [414, 258]];
  return [
    P('far-wing', far.outer, shade(WING), 'major'),
    P('tail', tail, WHITE),
    L('tail-l1', [[160, 304], [84, 292]], '#c9c2b4', 3),
    L('tail-l2', [[160, 312], [80, 316]], '#c9c2b4', 3),
    P('talon-1', [[250, 336], [242, 368], [262, 378], [276, 344]], GOLD, 'minor', { accent: true }),
    P('talon-2', [[292, 330], [286, 362], [304, 370], [310, 334]], GOLD, 'minor', { accent: true }),
    P('body', body, BROWN),
    P('head', head, WHITE),
    P('beak', beak, GOLD, 'major', { accent: true }),
    L('beak-line', [[416, 246], [452, 250]], '#b07a12', 3),
    P('iris', ellipse(392, 230, 12, 12, 14), '#f5c542', 'minor', { accent: true }),
    P('eye', ellipse(393, 231, 7.5, 8.5, 12), '#1e140c', 'eye'),
    P('glint', ellipse(395, 228, 3, 3, 8), '#ffffff', 'glint'),
    L('brow', [[376, 218], [392, 214], [408, 220]], '#7a7166', 4),
    P('near-wing', near.outer, WING),
    P('covert', near.covert, COVERT, 'minor'),
    ...near.lines.map((l, i) => L(`feather${i}`, l, '#2e1c10', 3)),
  ];
}
function shade(c: string) { // tiny local helper (avoid a cycle on the colour module for one call)
  const h = c.replace('#', '');
  const d = (i: number) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.72).toString(16).padStart(2, '0');
  return `#${d(0)}${d(2)}${d(4)}`;
}

export const LAB_MOUNTS: MountArt[] = [
  { id: 'cowboy_cookie', name: 'Cowboy Cookie', parts: cookie },
  { id: 'eagle', name: 'Bald Eagle', parts: eagle },
];
export { shift };
