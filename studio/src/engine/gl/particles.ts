/**
 * Partikel-Renderer (WebGL 1, gl.POINTS). Jede Bahn wird im Vertex-Shader aus Zufallswerten und der Zeit berechnet –
 * kein Zustand auf der CPU, deshalb flüssig auch mit Tausenden Partikeln und an jedem Zeitpunkt gleich (spulbar).
 */

export const PARTICLE_PRESETS = ['dust', 'snow', 'sparks', 'bokeh', 'confetti', 'stars', 'shape'] as const
export type ParticlePreset = (typeof PARTICLE_PRESETS)[number]

const VERTEX = `
precision highp float;
attribute vec4 a_seed;
attribute vec2 a_target;
uniform float u_time;
uniform float u_speed;
uniform float u_size;
uniform float u_preset;
uniform float u_form;
uniform float u_dpr;
uniform vec2 u_res;
uniform vec3 u_colors[5];
uniform float u_count;
varying vec3 v_color;
varying float v_alpha;
varying float v_angle;

const float TAU = 6.2831853;

void main() {
  float t = u_time * u_speed;
  vec2 p;
  float size = u_size;
  float alpha = 1.0;
  v_angle = 0.0;
  if (u_preset < 0.5) {
    // Staub: driftet langsam, funkelt leicht.
    p = fract(a_seed.xy + vec2(t * 0.006 * (a_seed.z - 0.5), -t * 0.004 * (0.3 + a_seed.w)));
    p += vec2(sin(t * 0.21 + a_seed.z * TAU), cos(t * 0.17 + a_seed.w * TAU)) * 0.012;
    size *= 0.4 + a_seed.z * 0.9;
    alpha = 0.35 + 0.45 * (0.5 + 0.5 * sin(t * (0.6 + a_seed.w) + a_seed.x * TAU));
  } else if (u_preset < 1.5) {
    // Schnee: fällt, pendelt sacht.
    float fall = 0.035 + 0.05 * a_seed.z;
    p = vec2(a_seed.x + sin(t * (0.4 + a_seed.w * 0.5) + a_seed.y * TAU) * 0.018, fract(a_seed.y + t * fall));
    size *= 0.5 + a_seed.z;
    alpha = 0.55 + 0.45 * a_seed.w;
  } else if (u_preset < 2.5) {
    // Funken: steigen, flackern, verglühen nach oben.
    float rise = fract(a_seed.y + t * (0.09 + 0.14 * a_seed.z));
    p = vec2(a_seed.x + sin(t * 1.3 + a_seed.w * TAU) * 0.01 + (rise - 0.5) * (a_seed.w - 0.5) * 0.12, 1.0 - rise);
    size *= 0.35 + a_seed.w * 0.8;
    alpha = (1.0 - rise) * (0.6 + 0.4 * sin(t * 14.0 + a_seed.x * 40.0));
  } else if (u_preset < 3.5) {
    // Bokeh: große, weiche Lichter, ziehen langsam.
    p = fract(a_seed.xy + vec2(sin(t * 0.05 + a_seed.z * TAU), cos(t * 0.04 + a_seed.w * TAU)) * 0.08);
    size *= 0.5 + a_seed.z * 1.3;
    alpha = 0.12 + 0.22 * a_seed.w;
  } else if (u_preset < 4.5) {
    // Konfetti: fällt schneller, dreht sich.
    float fall = 0.08 + 0.1 * a_seed.z;
    p = vec2(a_seed.x + sin(t * (1.2 + a_seed.w) + a_seed.y * TAU) * 0.03, fract(a_seed.y + t * fall));
    v_angle = t * (2.0 + a_seed.w * 4.0) + a_seed.x * TAU;
    size *= 0.7 + a_seed.z * 0.6;
    alpha = 0.95;
  } else if (u_preset < 5.5) {
    // Sterne: stehen, funkeln.
    p = a_seed.xy;
    size *= 0.3 + pow(a_seed.z, 3.0) * 1.4;
    alpha = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * (0.8 + a_seed.w * 2.5) + a_seed.z * TAU), 2.0);
  } else {
    // Form: zwischen verstreut und Ziel (Text/Bild) – u_form 0 … 1.
    vec2 scatter = fract(a_seed.xy + vec2(sin(t * 0.13 + a_seed.z * TAU), cos(t * 0.11 + a_seed.w * TAU)) * 0.05) * 1.6 - 0.3;
    float f = clamp(u_form * 1.35 - a_seed.z * 0.35, 0.0, 1.0);
    f = f * f * (3.0 - 2.0 * f);
    vec2 jitter = vec2(sin(t * 0.9 + a_seed.w * TAU), cos(t * 0.8 + a_seed.z * TAU)) * 0.0025;
    p = mix(scatter, a_target + jitter, f);
    size *= 0.7 + a_seed.w * 0.6;
    alpha = mix(0.35, 1.0, f);
  }
  int idx = int(floor(a_seed.w * u_count));
  vec3 c = u_colors[0];
  if (idx == 1) c = u_colors[1];
  if (idx == 2) c = u_colors[2];
  if (idx == 3) c = u_colors[3];
  if (idx == 4) c = u_colors[4];
  v_color = c;
  v_alpha = alpha;
  gl_PointSize = max(1.0, size * u_dpr);
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`

const FRAGMENT = `
precision highp float;
uniform float u_preset;
uniform float u_opacity;
varying vec3 v_color;
varying float v_alpha;
varying float v_angle;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float a;
  if (u_preset > 3.5 && u_preset < 4.5) {
    // Konfetti: gedrehtes Rechteck, das beim Drehen schmaler wird.
    float c = cos(v_angle);
    float s = sin(v_angle);
    vec2 q = vec2(c * pc.x - s * pc.y, s * pc.x + c * pc.y);
    q.y /= max(0.15, abs(cos(v_angle * 0.7)));
    a = step(abs(q.x), 0.42) * step(abs(q.y), 0.22);
  } else {
    float d = length(pc);
    float edge = u_preset > 2.5 && u_preset < 3.5 ? 0.18 : 0.32;
    a = 1.0 - smoothstep(edge, 0.5, d);
  }
  float alpha = a * v_alpha * u_opacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(v_color * alpha, alpha);
}`

export type ParticleUniforms = {
  time: number
  speed: number
  size: number
  form: number
  opacity: number
  colors: [number, number, number][]
  dpr: number
}

export type ParticleRenderer = {
  render: (u: ParticleUniforms, width: number, height: number) => void
  setTargets: (targets: Float32Array) => void
  destroy: () => void
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'Shader-Fehler')
  return sh
}

/** Wiederholbarer Zufall pro Partikel (gleiche Folie = gleiches Bild). */
function seeds(count: number): Float32Array {
  const out = new Float32Array(count * 4)
  let s = 1234567
  for (let i = 0; i < out.length; i++) {
    s = (s * 16807) % 2147483647
    out[i] = (s - 1) / 2147483646
  }
  return out
}

export function createParticles(canvas: HTMLCanvasElement, preset: ParticlePreset, count: number): ParticleRenderer | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
  if (!gl || gl.isContextLost()) return null
  try {
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Link-Fehler')
    gl.useProgram(program)

    const seedBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf)
    gl.bufferData(gl.ARRAY_BUFFER, seeds(count), gl.STATIC_DRAW)
    const aSeed = gl.getAttribLocation(program, 'a_seed')
    gl.enableVertexAttribArray(aSeed)
    gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0)

    const targetBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, targetBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(count * 2).fill(0.5), gl.DYNAMIC_DRAW)
    const aTarget = gl.getAttribLocation(program, 'a_target')
    gl.enableVertexAttribArray(aTarget)
    gl.vertexAttribPointer(aTarget, 2, gl.FLOAT, false, 0, 0)

    gl.enable(gl.BLEND)
    // Funken, Bokeh und Sterne leuchten additiv, der Rest deckt normal.
    if (preset === 'sparks' || preset === 'bokeh' || preset === 'stars') gl.blendFunc(gl.ONE, gl.ONE)
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const loc = new Map<string, WebGLUniformLocation | null>()
    const u = (n: string) => {
      if (!loc.has(n)) loc.set(n, gl.getUniformLocation(program, n))
      return loc.get(n) ?? null
    }
    const presetIndex = PARTICLE_PRESETS.indexOf(preset)

    return {
      setTargets(targets) {
        gl.bindBuffer(gl.ARRAY_BUFFER, targetBuf)
        gl.bufferData(gl.ARRAY_BUFFER, targets, gl.DYNAMIC_DRAW)
      },
      render(p, width, height) {
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        gl.viewport(0, 0, width, height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.uniform1f(u('u_time'), p.time)
        gl.uniform1f(u('u_speed'), p.speed)
        gl.uniform1f(u('u_size'), p.size)
        gl.uniform1f(u('u_preset'), presetIndex)
        gl.uniform1f(u('u_form'), p.form)
        gl.uniform1f(u('u_opacity'), p.opacity)
        gl.uniform1f(u('u_dpr'), p.dpr)
        gl.uniform2f(u('u_res'), width, height)
        const cols = Array.from({ length: 5 }, (_, i) => p.colors[i] ?? p.colors[0] ?? [1, 1, 1]).flat()
        gl.uniform3fv(u('u_colors'), cols)
        gl.uniform1f(u('u_count'), Math.max(1, Math.min(5, p.colors.length)))
        gl.drawArrays(gl.POINTS, 0, count)
      },
      destroy() {
        gl.deleteProgram(program)
        gl.deleteBuffer(seedBuf)
        gl.deleteBuffer(targetBuf)
        setTimeout(() => {
          if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext()
        }, 0)
      },
    }
  } catch (err) {
    console.warn('[studio] Partikel deaktiviert:', (err as Error).message)
    return null
  }
}

/**
 * Zielpunkte für die Form: Text oder Bild in ein verstecktes Canvas zeichnen und deckende Pixel abtasten.
 * Ergebnis: `count` Punkte (x, y in 0–1), gemischt, damit sich die Form gleichmäßig füllt.
 */
export function sampleShape(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  aspect: number,
  count: number,
): Float32Array {
  const w = 600
  const h = Math.max(1, Math.round(w / aspect))
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const out = new Float32Array(count * 2).fill(0.5)
  if (!ctx) return out
  draw(ctx, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  const pts: number[] = []
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / (count * 3))))
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if ((data[(y * w + x) * 4 + 3] ?? 0) > 120) pts.push(x / w, y / h)
    }
  }
  const n = pts.length / 2
  if (!n) return out
  let s = 98765
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647
    // Mehr Punkte als Partikel: gleichmäßig über die ganze Form verteilt auswählen (nicht nur die ersten Zeilen).
    const k = n >= count ? Math.floor((i * n) / count) : i < n ? i : s % n
    out[i * 2] = pts[k * 2]!
    out[i * 2 + 1] = pts[k * 2 + 1]!
  }
  // Mischen, damit Teilmengen (beim Zusammensetzen) über die ganze Form verteilt sind.
  for (let i = count - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    const tx = out[i * 2]!
    const ty = out[i * 2 + 1]!
    out[i * 2] = out[j * 2]!
    out[i * 2 + 1] = out[j * 2 + 1]!
    out[j * 2] = tx
    out[j * 2 + 1] = ty
  }
  return out
}
