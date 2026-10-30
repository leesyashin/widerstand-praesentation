/**
 * Minimaler WebGL-Renderer für ein bildschirmfüllendes Fragment-Shader-Quad.
 * Uniforms: u_time (s), u_res (px) plus beliebige float/vec-Uniforms.
 */
export type UniformValue = number | number[]
export type Uniforms = Record<string, UniformValue>

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

export type ShaderProgram = {
  render: (uniforms: Uniforms, width: number, height: number) => void
  /** Ressourcen freigeben. Der Kontext selbst wird nur verworfen, wenn das Canvas nicht mehr im Dokument hängt. */
  destroy: () => void
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Shader konnte nicht erzeugt werden')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader-Fehler: ${log}`)
  }
  return shader
}

export function createProgram(canvas: HTMLCanvasElement, fragment: string): ShaderProgram | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false })
  if (!gl || gl.isContextLost()) return null
  try {
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, `precision highp float;\n${fragment}`))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Link-Fehler')
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    // Ein großes Dreieck deckt den ganzen Bildschirm ab.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const locations = new Map<string, WebGLUniformLocation | null>()
    const uniform = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name))
      return locations.get(name) ?? null
    }
    return {
      render(uniforms, width, height) {
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        gl.viewport(0, 0, width, height)
        gl.uniform2f(uniform('u_res'), width, height)
        for (const [name, value] of Object.entries(uniforms)) {
          const loc = uniform(name)
          if (!loc) continue
          if (typeof value === 'number') gl.uniform1f(loc, value)
          else if (value.length === 2) gl.uniform2fv(loc, value)
          else if (value.length === 3) gl.uniform3fv(loc, value)
          else if (value.length === 4) gl.uniform4fv(loc, value)
          else gl.uniform3fv(loc, value) // Arrays von vec3 (Länge = 3·n)
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      },
      destroy() {
        gl.deleteProgram(program)
        gl.deleteBuffer(buffer)
        // Erst nach dem Commit prüfen: React (StrictMode) hängt dasselbe Canvas sonst sofort wieder ein.
        setTimeout(() => {
          if (!canvas.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext()
        }, 0)
      },
    }
  } catch (err) {
    console.warn('[studio] WebGL-Effekt deaktiviert:', (err as Error).message)
    return null
  }
}
