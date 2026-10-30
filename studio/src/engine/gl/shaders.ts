/**
 * Fragment-Shader der Signature-Effekte. Alle Werte 0–1, Zeit in Sekunden.
 * Gemeinsam: Hash-Rauschen und Dithering gegen Banding in dunklen Verläufen.
 */

const COMMON = `
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

vec3 dither(vec3 c) {
  return c + (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;
}
`

/**
 * Licht-Verlauf: bis zu 5 Lichtquellen in Brand-Farben, die langsam auf eigenen Bahnen wandern,
 * mit organischer Verwirbelung. u_base = Grundfarbe, u_colors = vec3[5], u_count = Anzahl.
 */
export const MESH = `${COMMON}
uniform vec3 u_base;
uniform vec3 u_colors[5];
uniform float u_count;
uniform float u_speed;

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time * 0.06 * u_speed;
  // Organische Verwirbelung des Raums
  vec2 warp = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 7.3)) - 0.5;
  p += warp * 0.35;

  vec3 col = u_base;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= u_count) break;
    float fi = float(i);
    vec2 center = vec2(
      (0.5 + 0.38 * sin(t * (0.9 + fi * 0.23) + fi * 2.1)) * aspect,
      0.5 + 0.36 * cos(t * (0.7 + fi * 0.19) + fi * 1.3)
    );
    float d = length(p - center);
    float w = exp(-d * d * 3.2);
    col = mix(col, u_colors[i], w * 0.92);
  }
  gl_FragColor = vec4(dither(col), 1.0);
}`

/** Filmkorn: zeitlich wechselndes Rauschen mit 24 Bildern pro Sekunde, als Overlay gemischt. */
export const GRAIN = `${COMMON}
uniform float u_amount;

void main() {
  float frame = floor(u_time * 24.0);
  vec2 p = gl_FragCoord.xy + vec2(frame * 17.0, frame * 31.0);
  float n = hash(p) * 0.6 + hash(p * 0.5 + 3.1) * 0.4;
  gl_FragColor = vec4(vec3(n), u_amount);
}`

/** Licht-Sweep: ein weicher, leicht flimmernder Lichtstreifen, der alle ~8 s diagonal durchs Bild gleitet. */
export const SWEEP = `${COMMON}
uniform float u_amount;
uniform vec3 u_tint;

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / u_res.y;
  float cycle = mod(u_time, 8.0) / 8.0;
  float pos = mix(-0.6, 1.6, smoothstep(0.0, 0.55, cycle));
  float along = (uv.x * aspect * 0.8 + (1.0 - uv.y) * 0.6) / (aspect * 0.8 + 0.6);
  float d = along - pos;
  float band = exp(-d * d * 90.0) + 0.35 * exp(-d * d * 12.0);
  float flicker = 0.85 + 0.15 * fbm(vec2(uv.y * 6.0, u_time * 0.8));
  float a = band * flicker * u_amount * (1.0 - smoothstep(0.55, 0.62, cycle));
  gl_FragColor = vec4(mix(vec3(1.0), u_tint, 0.35), a);
}`

/** Light Leak: organisches Licht, das von einer Seite hereinflutet; Höhepunkt bei progress 0.5. */
export const LEAK = `${COMMON}
uniform float u_progress;
uniform vec3 u_tint;

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float peak = sin(u_progress * 3.14159);
  vec2 source = vec2(mix(-0.3, aspect + 0.3, u_progress), 0.65 + 0.2 * sin(u_progress * 2.0));
  float d = length(p - source);
  float flow = fbm(p * 2.2 + vec2(u_progress * 1.5, 0.0));
  float glow = exp(-d * d * 1.6) * (0.6 + 0.8 * flow);
  vec3 warm = mix(u_tint, vec3(1.0, 0.82, 0.62), 0.25);
  vec3 col = mix(warm, vec3(1.0), smoothstep(0.6, 1.2, glow));
  gl_FragColor = vec4(col, clamp(glow * peak * 1.4, 0.0, 1.0));
}`
