import { COMMON } from './shaders'

/**
 * Generative Muster (Fragment-Shader). Gemeinsame Uniforms:
 * u_base (Grundfarbe), u_colors[4] + u_count (Licht-/Linienfarben), u_speed, u_scale (0 groß … 1 fein),
 * u_intensity (0–1), u_res, u_time.
 */
const HEAD = `${COMMON}
uniform vec3 u_base;
uniform vec3 u_colors[4];
uniform float u_count;
uniform float u_speed;
uniform float u_scale;
uniform float u_intensity;

vec3 pick(float x) {
  // Farbverlauf über die Linien-/Lichtfarben (x 0–1).
  float n = max(1.0, u_count);
  float f = clamp(x, 0.0, 0.999) * n;
  vec3 a = u_colors[0];
  vec3 b = u_colors[0];
  for (int i = 0; i < 4; i++) {
    if (float(i) == floor(f)) a = u_colors[i];
    if (float(i) == min(n - 1.0, floor(f) + 1.0)) b = u_colors[i];
  }
  return mix(a, b, fract(f));
}

vec2 aspectUv() {
  return vec2(v_uv.x * u_res.x / u_res.y, v_uv.y);
}
`

/** Flow-Field: Linien folgen einem verwirbelten Strömungsfeld. */
const FLOW = `${HEAD}
void main() {
  vec2 p = aspectUv() * mix(1.5, 6.0, u_scale);
  float t = u_time * 0.05 * u_speed;
  vec2 q = vec2(fbm(p + t), fbm(p - t + 3.1));
  float f = fbm(p + q * 2.2 + t * 0.6);
  float lines = abs(sin(f * 38.0));
  float ink = (1.0 - smoothstep(0.0, 0.18, lines)) * u_intensity;
  vec3 col = mix(u_base, pick(f), ink);
  col += pick(q.x) * 0.12 * u_intensity;
  gl_FragColor = vec4(dither(col), 1.0);
}`

/** Rauschwolken: weiche, sich verformende Felder. */
const NOISE = `${HEAD}
void main() {
  vec2 p = aspectUv() * mix(0.8, 4.0, u_scale);
  float t = u_time * 0.04 * u_speed;
  vec2 q = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.5), fbm(p + 3.0 * q + vec2(8.3, 2.8)));
  float f = fbm(p + 3.0 * r);
  vec3 col = mix(u_base, pick(f * 1.2), smoothstep(0.25, 0.85, f) * u_intensity);
  gl_FragColor = vec4(dither(col), 1.0);
}`

/** Perspektiv-Gitter, das auf dich zufährt, mit Horizont-Licht. */
const GRID = `${HEAD}
void main() {
  vec2 uv = v_uv;
  float horizon = 0.55;
  vec3 col = u_base;
  float glow = exp(-abs(uv.y - horizon) * 14.0);
  col += pick(0.0) * glow * 0.5 * u_intensity;
  if (uv.y < horizon) {
    float depth = horizon - uv.y;
    float z = 0.25 / max(depth, 0.001);
    float x = (uv.x - 0.5) * z * mix(3.0, 9.0, u_scale);
    float zz = z * mix(2.0, 5.0, u_scale) + u_time * 0.8 * u_speed;
    float gx = abs(fract(x) - 0.5);
    float gz = abs(fract(zz) - 0.5);
    float w = 0.02 * z;
    float line = max(1.0 - smoothstep(0.0, w + 0.01, gx), 1.0 - smoothstep(0.0, w + 0.01, gz));
    float fade = smoothstep(0.0, 0.25, depth) * (1.0 - smoothstep(0.35, 0.55, depth) * 0.3);
    col = mix(col, pick(clamp(depth * 2.0, 0.0, 1.0)), line * fade * u_intensity);
  }
  gl_FragColor = vec4(dither(col), 1.0);
}`

/** Höhenlinien: Konturlinien eines langsam atmenden Rauschfelds (topografisch). */
const WAVES = `${HEAD}
void main() {
  vec2 p = aspectUv() * mix(1.0, 4.0, u_scale);
  float t = u_time * 0.05 * u_speed;
  float f = fbm(p + vec2(t, -t * 0.7)) + 0.3 * fbm(p * 2.0 - t);
  float bands = fract(f * 14.0);
  float line = 1.0 - smoothstep(0.0, 0.06, min(bands, 1.0 - bands));
  vec3 col = mix(u_base, pick(f), line * u_intensity);
  gl_FragColor = vec4(dither(col), 1.0);
}`

/** Ringe: Wellen breiten sich von mehreren Zentren aus. */
const RINGS = `${HEAD}
void main() {
  vec2 p = aspectUv();
  float aspect = u_res.x / u_res.y;
  float t = u_time * 0.35 * u_speed;
  float v = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2((0.3 + 0.2 * fi) * aspect + 0.1 * sin(t * 0.3 + fi), 0.4 + 0.15 * cos(t * 0.25 + fi * 2.0));
    float d = length(p - c);
    v += sin(d * mix(20.0, 70.0, u_scale) - t * 2.0 - fi) * exp(-d * 1.6);
  }
  float line = smoothstep(0.55, 1.0, v * 0.5 + 0.5);
  vec3 col = mix(u_base, pick(clamp(v * 0.25 + 0.5, 0.0, 1.0)), line * u_intensity);
  gl_FragColor = vec4(dither(col), 1.0);
}`

/** Plasma: klassisch, satt fließende Farbfelder. */
const PLASMA = `${HEAD}
void main() {
  vec2 p = aspectUv() * mix(2.0, 8.0, u_scale);
  float t = u_time * 0.4 * u_speed;
  float v = sin(p.x + t) + sin(p.y * 1.3 - t * 0.8) + sin((p.x + p.y) * 0.7 + t * 0.6) + sin(length(p - 2.0) * 1.5 - t);
  float f = v * 0.125 + 0.5;
  vec3 col = mix(u_base, pick(f), u_intensity);
  gl_FragColor = vec4(dither(col), 1.0);
}`

export const GENERATIVE = { flow: FLOW, noise: NOISE, grid: GRID, waves: WAVES, rings: RINGS, plasma: PLASMA } as const
