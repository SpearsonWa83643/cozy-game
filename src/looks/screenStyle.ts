import Phaser from 'phaser';
import { looks } from './looks';
import type { ArtStyleId } from './styleFx';

/**
 * 63 (dev preview): the applied Looks & Moves art style restyles the WHOLE screen with one cheap
 * full-screen post-process on the game cameras (world, wild, interiors). One shader, a mode per style:
 *   1 Cel: bold dark outlines (luma edge) + flat cel bands     2 Watercolor: paper grain, soft bleed, pigment edges
 *   3 Ink & Wash: pen hatching in the shadows + ink lines       4 Pixel: chunky pixels + posterized palette
 *   5 Gouache: rich, flat, slightly brushy paint                6 Clay: soft emboss lighting + warm matte bands
 * Classic = off (filter inactive, zero cost). At most 9 texture reads per pixel; no extra render passes.
 */
export const STYLE_MODE: Record<ArtStyleId, number> = { classic: 0, cel: 1, watercolor: 2, ink: 3, pixel: 4, gouache: 5, clay: 6 };

const FRAG = `#pragma phaserTemplate(shaderName)
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float mode;
uniform float scale;
varying vec2 outTexCoord;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
vec3 tex(vec2 uv) { return texture2D(uMainSampler, uv).rgb; }
vec3 bands(vec3 c, float n) {
  // Flatten brightness into n bands but keep the hue (so it reads as cel paint, not a cheap posterize).
  float l = max(luma(c), 0.001);
  float q = (floor(l * n) + 0.55) / n;
  return clamp(c * (q / l), 0.0, 1.0);
}
float edge(vec2 uv, vec2 px) {
  float tl = luma(tex(uv + px * vec2(-1.0, -1.0))), tr = luma(tex(uv + px * vec2(1.0, -1.0)));
  float bl = luma(tex(uv + px * vec2(-1.0, 1.0))), br = luma(tex(uv + px * vec2(1.0, 1.0)));
  float gx = (tr + br) - (tl + bl), gy = (bl + br) - (tl + tr);
  return sqrt(gx * gx + gy * gy);
}

void main () {
  vec2 uv = outTexCoord;
  vec2 px = scale / resolution;
  vec2 fc = uv * resolution / scale;
  vec4 src = texture2D(uMainSampler, uv);
  vec3 c = src.rgb;
  vec3 o = c;
  if (mode < 0.5) {
    o = c;
  } else if (mode < 1.5) {
    // Cel
    float e = edge(uv, px * 1.2);
    o = bands(c, 4.0);
    o = mix(o, o * 1.12 + 0.03, step(0.8, luma(c)));
    o = mix(o, vec3(0.13, 0.09, 0.12), smoothstep(0.16, 0.34, e));
  } else if (mode < 2.5) {
    // Watercolor: wobble the lookup (bleed), lift and soften, darker pigment pooling at edges, paper grain.
    vec2 w = (vec2(vnoise(fc * 0.06), vnoise(fc * 0.06 + 7.3)) - 0.5) * px * 5.0;
    vec3 a = tex(uv + w), b = tex(uv - w * 0.6 + px * vec2(1.5, 0.0)), d = tex(uv + px * vec2(0.0, 1.5));
    vec3 s = (a * 2.0 + b + d) / 4.0;
    float e = edge(uv + w, px * 1.5);
    s = mix(s, vec3(luma(s)), 0.12);
    s = mix(s, vec3(1.0, 0.98, 0.94), 0.12);
    s *= 1.0 - smoothstep(0.08, 0.4, e) * 0.22;
    float paper = vnoise(fc * 0.9) * 0.6 + vnoise(fc * 0.25) * 0.4;
    o = s * (0.93 + paper * 0.1);
  } else if (mode < 3.5) {
    // Ink & Wash: sepia wash in a few tones, cross-hatching where it is dark, pen outlines.
    float l = luma(c);
    float e = edge(uv, px);
    vec3 wash = mix(vec3(0.24, 0.2, 0.18), vec3(0.98, 0.95, 0.88), (floor(l * 4.0) + 0.5) / 4.0);
    wash = mix(wash, c, 0.32);
    float h1 = step(0.5, fract((fc.x + fc.y) / 5.0));
    float h2 = step(0.5, fract((fc.x - fc.y) / 5.0));
    float ink = 0.0;
    if (l < 0.55) ink = max(ink, (1.0 - h1) * 0.55);
    if (l < 0.33) ink = max(ink, (1.0 - h2) * 0.6);
    ink = max(ink, smoothstep(0.14, 0.32, e));
    o = mix(wash, vec3(0.12, 0.1, 0.12), ink);
    o *= 0.96 + vnoise(fc * 0.8) * 0.06;
  } else if (mode < 4.5) {
    // Pixel: 4-px blocks (in CSS px) sampled at the block centre, 6-level palette, faint grid.
    float b = 4.0;
    vec2 cell = floor(fc / b) * b + b * 0.5;
    vec3 p = tex(cell * scale / resolution);
    p = floor(p * 6.0 + 0.5) / 6.0;
    vec2 g = fract(fc / b);
    float grid = step(0.88, max(g.x, g.y));
    o = p * (1.0 - grid * 0.08);
  } else if (mode < 5.5) {
    // Gouache: brushy wobble, richer colour, broad flat bands, matte paper.
    vec2 w = (vec2(vnoise(fc * 0.18), vnoise(fc * 0.18 + 3.1)) - 0.5) * px * 3.0;
    vec3 s = (tex(uv + w) * 2.0 + tex(uv + w + px * vec2(1.0, 1.0))) / 3.0;
    float l = luma(s);
    s = clamp(mix(vec3(l), s, 1.25), 0.0, 1.0);
    s = mix(s, bands(s, 6.0), 0.65);
    o = s * (0.95 + vnoise(fc * 0.5) * 0.07);
  } else {
    // Clay: soft emboss from the brightness slope (light from the top-left), warm matte bands, rounded edges.
    float l0 = luma(tex(uv - px * 1.5)), l1 = luma(tex(uv + px * 1.5));
    float lit = (l1 - l0) * -1.8;
    vec3 s = bands(c, 7.0);
    s = mix(s, s * vec3(1.06, 0.98, 0.9), 0.5);
    float e = edge(uv, px * 2.0);
    o = clamp(s + lit * 0.35, 0.0, 1.0);
    o *= 1.0 - smoothstep(0.2, 0.5, e) * 0.18;
    o += (vnoise(fc * 1.3) - 0.5) * 0.03;
  }
  gl_FragColor = vec4(o * src.a, src.a);
}
`;

export class ScreenStyle extends Phaser.Filters.Controller {
  mode = 0;
  constructor(camera: Phaser.Cameras.Scene2D.Camera) { super(camera, 'WGScreenStyle'); }
}

let registered = false;
function register(renderer: Phaser.Renderer.WebGL.WebGLRenderer) {
  if (registered) return;
  registered = true;
  const Base = (Phaser.Renderer.WebGL.RenderNodes as any).BaseFilterShader;
  class Node extends Base {
    constructor(manager: any) { super('WGScreenStyle', manager, null, FRAG); }
    setupUniforms(controller: ScreenStyle, dc: any) {
      const pm = (this as any).programManager;
      pm.setUniform('mode', controller.mode);
      pm.setUniform('resolution', [dc.width, dc.height]);
      pm.setUniform('scale', Math.max(1, (window.devicePixelRatio || 1) * 0.85));
    }
  }
  (renderer as any).renderNodes.addNodeConstructor('WGScreenStyle', Node);
}

/** Debug counters (tests). */
export const screenStyleStats = { attached: [] as string[], mode: 0 };

/** Put the applied style's screen filter on this scene's main camera and keep it in sync with Apply. */
export function attachScreenStyle(scene: Phaser.Scene) {
  const r = scene.game.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return null;
  register(r);
  const cam = scene.cameras.main;
  const f = new ScreenStyle(cam);
  (cam as any).filters.external.add(f);
  const sync = () => {
    f.mode = STYLE_MODE[looks.art] ?? 0;
    f.active = f.mode > 0;
    screenStyleStats.mode = f.mode;
  };
  sync();
  const off = looks.on(sync);
  if (!screenStyleStats.attached.includes(scene.scene.key)) screenStyleStats.attached.push(scene.scene.key);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { off(); try { (cam as any).filters?.external.remove(f); } catch { /* gone */ } });
  return f;
}
(window as any).__screenStyle = screenStyleStats;
