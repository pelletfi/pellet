"use client";

import { useEffect, useRef } from "react";

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform vec3 uBg;
uniform vec3 uFg;
uniform float uCellSize;
uniform float uDim;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.877, 0.479, -0.479, 0.877);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + vec2(100.0);
    a *= 0.5;
  }
  return v;
}

float charDensity(float v) {
  float idx = clamp(v * 10.0, 0.0, 9.0);
  float densities[10] = float[10](
    0.0, 0.08, 0.15, 0.2, 0.3, 0.4, 0.55, 0.65, 0.78, 0.9
  );
  int i = int(idx);
  int j = min(i + 1, 9);
  return mix(densities[i], densities[j], fract(idx));
}

float charPattern(vec2 cellUV, float density) {
  if (density < 0.01) return 0.0;
  float h = hash(floor(cellUV * 5.0));
  return step(1.0 - density, h);
}

void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
  vec2 m = (2.0 * iMouse.xy - iResolution.xy) / iResolution.y;

  float cellSize = uCellSize;
  vec2 cellID = floor(gl_FragCoord.xy / cellSize);
  vec2 cellUV = fract(gl_FragCoord.xy / cellSize);
  vec2 cellCenter = (cellID + 0.5) * cellSize;
  vec2 cp = (2.0 * cellCenter - iResolution.xy) / iResolution.y;

  float t = iTime * 0.3;

  // gentle breathing — slow global pulse
  float breath = 0.08 + 0.04 * sin(t * 0.7);

  // slight spatial variation so it's not perfectly uniform
  float vary = noise(cp * 2.0 + t * 0.1) * 0.03;

  float v = breath + vary;

  // cursor warm spot
  float md = length(cp - m);
  v += exp(-md * md * 5.0) * 0.12;

  v = clamp(v, 0.0, 1.0);

  // just dots — single centered dot per cell
  vec2 center = cellUV - 0.5;
  float d = length(center);
  float r = 0.15 + v * 0.1;
  float aa = fwidth(d);
  float dt = 1.0 - smoothstep(r - aa, r + aa, d);

  float intensity = dt * v * 2.5 * uDim;

  // on light bg, darken dots subtly; on dark bg, lighten them
  float bgLum = dot(uBg, vec3(0.299, 0.587, 0.114));
  vec3 dotColor = bgLum > 0.4
    ? uBg - vec3(intensity * 0.15)
    : mix(uBg, uFg, intensity);
  fragColor = vec4(dotColor, 1.0);
}`;

function parseColor(css: string): [number, number, number] {
  const m = css.match(/\d+/g);
  if (!m || m.length < 3) return [0, 0, 0];
  return [parseInt(m[0]) / 255, parseInt(m[1]) / 255, parseInt(m[2]) / 255];
}

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
  if (!gl) return null;

  function compile(type: number, src: string) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      console.error(gl!.getShaderInfoLog(s));
    }
    return s;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  return {
    gl,
    uRes: gl.getUniformLocation(prog, "iResolution"),
    uTime: gl.getUniformLocation(prog, "iTime"),
    uMouse: gl.getUniformLocation(prog, "iMouse"),
    uBg: gl.getUniformLocation(prog, "uBg"),
    uFg: gl.getUniformLocation(prog, "uFg"),
    uCell: gl.getUniformLocation(prog, "uCellSize"),
    uDim: gl.getUniformLocation(prog, "uDim"),
  };
}

export function LiquidGlass({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0, init: false });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = initGL(canvas);
    if (!ctx) return;
    const { gl, uRes, uTime, uMouse, uBg, uFg, uCell, uDim } = ctx;

    let raf = 0;
    const t0 = performance.now();
    let last = t0;

    const dpr = () => 1;

    function resize() {
      const d = dpr();
      const w = Math.floor(canvas!.clientWidth * d);
      const h = Math.floor(canvas!.clientHeight * d);
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
      gl.viewport(0, 0, canvas!.width, canvas!.height);
    }

    let bgCache: [number, number, number] = [0, 0, 0];
    let fgCache: [number, number, number] = [1, 1, 1];
    let themeDirty = true;

    function readTheme() {
      const parent = canvas!.closest(".specimen-shell")
        || document.querySelector(".specimen-shell");
      if (parent) {
        const isDark = parent.classList.contains("dark");
        bgCache = isDark ? [17/255, 17/255, 17/255] : [188/255, 188/255, 188/255];
        fgCache = isDark ? [188/255, 188/255, 188/255] : [17/255, 17/255, 17/255];
      }
      themeDirty = false;
    }

    const shell = canvas!.closest(".specimen-shell")
      || document.querySelector(".specimen-shell");
    const observer = shell
      ? new MutationObserver(() => { themeDirty = true; })
      : null;
    if (shell && observer) {
      observer.observe(shell, { attributes: true, attributeFilter: ["class"] });
    }

    function sampleTheme() {
      if (themeDirty) readTheme();
    }

    const FRAME_MS = 33; // ~30fps cap

    function frame() {
      const now = performance.now();
      const dt = (now - last) / 1000;

      if (now - last < FRAME_MS) {
        raf = requestAnimationFrame(frame);
        return;
      }
      last = now;

      const lerp = 1 - Math.exp(-dt / 0.08);
      const m = mouse.current;
      m.x += (m.tx - m.x) * lerp;
      m.y += (m.ty - m.y) * lerp;

      sampleTheme();
      resize();
      const realDpr = Math.min(window.devicePixelRatio || 1, 2);
      const mobile = canvas!.clientWidth <= 640;
      gl.uniform1f(uCell, (mobile ? 5.0 : 8.0) / realDpr);
      gl.uniform1f(uDim, mobile ? 0.5 : 1.0);
      gl.uniform3f(uRes, canvas!.width, canvas!.height, 1);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform4f(uMouse, m.x, m.y, 0, 0);
      gl.uniform3f(uBg, bgCache[0], bgCache[1], bgCache[2]);
      gl.uniform3f(uFg, fgCache[0], fgCache[1], fgCache[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }

    function onMove(e: MouseEvent) {
      const d = dpr();
      const rect = canvas!.getBoundingClientRect();
      const m = mouse.current;
      m.tx = (e.clientX - rect.left) * d;
      m.ty = (rect.height - (e.clientY - rect.top)) * d;
      if (!m.init) {
        m.x = m.tx;
        m.y = m.ty;
        m.init = true;
      }
    }

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      observer?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
}
