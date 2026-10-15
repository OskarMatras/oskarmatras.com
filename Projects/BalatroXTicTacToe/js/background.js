// @ts-check
/**
 * The slow swirling felt behind the table: one WebGL fragment shader drawn
 * at a quarter of the screen resolution and scaled up with pixelated
 * sampling, which keeps it cheap on phones and gives it the chunky look.
 * Pauses while the tab is hidden; draws one still frame for
 * prefers-reduced-motion. Without WebGL the CSS background shows instead.
 */
/** @param {HTMLCanvasElement} cv */
export function startBackground(cv) {
  /** @type {WebGLRenderingContext|null} */
  let gl = null;
  try { gl = cv.getContext('webgl', { antialias: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return;
  const g = gl;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;uniform vec2 R;uniform float T;
  void main(){vec2 p=(gl_FragCoord.xy-.5*R)/R.y;float d=length(p);
    float a=atan(p.y,p.x)+T*.04+d*1.8;vec2 q=vec2(cos(a),sin(a))*d;
    float v=sin(q.x*6.+T*.25)+sin(q.y*7.-T*.2)+sin((q.x+q.y)*5.+T*.15)+sin(d*9.-T*.3);
    v=v*.125+.5;
    vec3 c0=vec3(.035,.105,.098),c1=vec3(.062,.20,.18),c2=vec3(.09,.27,.23);
    vec3 col=mix(c0,c1,smoothstep(.25,.6,v));col=mix(col,c2,smoothstep(.62,.8,v)*.8);
    col*=1.-d*.5;gl_FragColor=vec4(col,1.);}`;
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
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const size = () => {
    cv.width = Math.max(1, Math.floor(innerWidth / 4));
    cv.height = Math.max(1, Math.floor(innerHeight / 4));
    g.viewport(0, 0, cv.width, cv.height);
  };
  const t0 = performance.now();
  const draw = () => {
    g.uniform2f(uR, cv.width, cv.height);
    g.uniform1f(uT, (performance.now() - t0) / 1000);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  };
  size();
  addEventListener('resize', () => { size(); if (reduce) draw(); });
  if (reduce) { draw(); return; }
  const loop = () => { if (!document.hidden) draw(); requestAnimationFrame(loop); };
  loop();
}
