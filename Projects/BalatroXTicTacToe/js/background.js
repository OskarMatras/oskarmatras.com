// @ts-check
/**
 * The slow swirling paint behind the table: one WebGL fragment shader drawn at a
 * quarter of the screen resolution and scaled up with pixelated sampling, which
 * keeps it cheap on phones and gives it the chunky look. The colours ease toward
 * whatever setBackdrop() last asked for, so the room changes colour with the
 * blind you are facing (blue, amber, the boss's own colour) and with the shop.
 * Pauses while the tab is hidden; draws one still frame for
 * prefers-reduced-motion. Without WebGL the CSS background shows instead.
 */

/** Where the colours are heading and where they are now (dark, mid, light as r,g,b 0-1). */
const target = { A: [.03, .13, .11], B: [.07, .27, .22], C: [.14, .46, .36] };
const now = { A: [...target.A], B: [...target.B], C: [...target.C] };
/** @type {null | (() => void)} */ let wake = null;
/** A scoring effect shoves the backdrop: it brightens, spins faster and washes toward the effect's colour, then settles. */
const pulse = { k: 0, color: [1, .8, .3] };
/** @param {number} power 0..1 @param {string} [hex] */
export function pulseBackdrop(power, hex) {
  pulse.k = Math.min(1, Math.max(pulse.k, power));
  if (hex) pulse.color = rgb(hex);
}

/** @param {string} hex '#rrggbb' */
function rgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
/**
 * Tint the backdrop. One colour in, a dark/mid/light ramp out.
 * @param {string} hex
 */
export function setBackdrop(hex) {
  const c = rgb(hex);
  const ramp = (/** @type {number} */ k) => c.map(v => Math.min(1, v * k));
  target.A = ramp(.30); target.B = ramp(.52); target.C = ramp(.88);
  if (wake) wake();
}

/** @param {HTMLCanvasElement} cv */
export function startBackground(cv) {
  /** @type {WebGLRenderingContext|null} */
  let gl = null;
  try { gl = cv.getContext('webgl', { antialias: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return;
  const g = gl;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  // Swirl the plane, warp it a few times, then cut the result into flat bands: paint, not a gradient.
  const fs = `precision mediump float;uniform vec2 R;uniform float T;uniform vec3 A;uniform vec3 B;uniform vec3 C;uniform float K;uniform vec3 F;
  void main(){
    vec2 p=(gl_FragCoord.xy-.5*R)/R.y*1.25;
    float d=length(p);
    float s=atan(p.y,p.x)+d*2.7+T*.05-K*d*.9;
    vec2 q=vec2(cos(s),sin(s))*d;
    for(int i=0;i<4;i++){
      float f=float(i);
      q+=.33*vec2(sin(q.y*3.1+T*.13+f*1.7),cos(q.x*2.7-T*.11+f*2.3));
    }
    float v=.5+.5*sin(q.x*4.4+q.y*3.7+d*3.2);
    v=floor(v*5.+.5)/5.;
    vec3 col=mix(A,B,smoothstep(.15,.5,v));
    col=mix(col,C,smoothstep(.55,.9,v));
    col=mix(col,F,K*.22*(1.-d*.7));
    col*=(1.-.62*d*d)*(1.+K*.55);
    gl_FragColor=vec4(col,1.);}`;
  const sh = (/** @type {number} */ type, /** @type {string} */ src) => { const o = /** @type {WebGLShader} */ (g.createShader(type)); g.shaderSource(o, src); g.compileShader(o); return o; };
  const pr = /** @type {WebGLProgram} */ (g.createProgram());
  g.attachShader(pr, sh(g.VERTEX_SHADER, vs));
  g.attachShader(pr, sh(g.FRAGMENT_SHADER, fs));
  g.linkProgram(pr);
  if (!g.getProgramParameter(pr, g.LINK_STATUS)) return;
  g.useProgram(pr);
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(pr, 'p');
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  const uR = g.getUniformLocation(pr, 'R'), uT = g.getUniformLocation(pr, 'T');
  const uK = g.getUniformLocation(pr, 'K'), uF = g.getUniformLocation(pr, 'F');
  const uA = g.getUniformLocation(pr, 'A'), uB = g.getUniformLocation(pr, 'B'), uC = g.getUniformLocation(pr, 'C');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size = () => {
    cv.width = Math.max(1, Math.floor(innerWidth / 4));
    cv.height = Math.max(1, Math.floor(innerHeight / 4));
    g.viewport(0, 0, cv.width, cv.height);
  };
  const t0 = performance.now();
  let lastT = t0, phase = 0;
  const draw = () => {
    const t = performance.now(), dt = Math.min(.1, (t - lastT) / 1000); lastT = t;
    // The swirl runs on its own clock so a pulse can speed it up without the picture jumping.
    phase += dt * (1 + pulse.k * 5); pulse.k *= Math.exp(-dt * 2.4); if (pulse.k < .004) pulse.k = 0;
    // Ease the palette (a second or so), or jump straight there if motion is reduced.
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
    for (const key of /** @type {('A'|'B'|'C')[]} */ (['A', 'B', 'C'])) for (let i = 0; i < 3; i++) now[key][i] += (target[key][i] - now[key][i]) * k;
    g.uniform2f(uR, cv.width, cv.height);
    g.uniform1f(uT, phase);
    g.uniform1f(uK, reduce ? 0 : pulse.k);
    g.uniform3f(uF, pulse.color[0], pulse.color[1], pulse.color[2]);
    g.uniform3f(uA, now.A[0], now.A[1], now.A[2]);
    g.uniform3f(uB, now.B[0], now.B[1], now.B[2]);
    g.uniform3f(uC, now.C[0], now.C[1], now.C[2]);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  };
  size();
  addEventListener('resize', () => { size(); if (reduce) draw(); });
  if (reduce) { wake = draw; draw(); return; }
  const loop = () => { if (!document.hidden) draw(); requestAnimationFrame(loop); };
  loop();
}
