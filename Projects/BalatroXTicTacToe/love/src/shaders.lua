-- GLSL shaders (LÖVE dialect). All written for this project.
local M = {}

-- The slow swirling felt behind the table. Same maths as the web version's
-- WebGL fragment shader; drawn at a quarter of the screen resolution and
-- scaled up without smoothing for the chunky look.
local BACKGROUND = [[
extern number T;
extern vec2 R;
vec4 effect(vec4 color, Image tex, vec2 uv, vec2 sc) {
  vec2 frag = vec2(sc.x, R.y - sc.y);
  vec2 p = (frag - 0.5 * R) / R.y;
  float d = length(p);
  float a = atan(p.y, p.x) + T * 0.04 + d * 1.8;
  vec2 q = vec2(cos(a), sin(a)) * d;
  float v = sin(q.x * 6.0 + T * 0.25) + sin(q.y * 7.0 - T * 0.2) + sin((q.x + q.y) * 5.0 + T * 0.15) + sin(d * 9.0 - T * 0.3);
  v = v * 0.125 + 0.5;
  vec3 c0 = vec3(0.035, 0.105, 0.098);
  vec3 c1 = vec3(0.062, 0.20, 0.18);
  vec3 c2 = vec3(0.09, 0.27, 0.23);
  vec3 col = mix(c0, c1, smoothstep(0.25, 0.6, v));
  col = mix(col, c2, smoothstep(0.62, 0.8, v) * 0.8);
  col *= 1.0 - d * 0.5;
  return vec4(col, 1.0);
}
]]

-- Whole-frame CRT look: gentle barrel bend, scanlines, vignette, a touch of
-- colour fringing and a slow flicker.
local CRT = [[
extern number T;
extern vec2 R;
vec4 effect(vec4 color, Image tex, vec2 uv, vec2 sc) {
  vec2 c = uv * 2.0 - 1.0;
  c *= 1.0 + 0.018 * dot(c, c);
  vec2 u = c * 0.5 + 0.5;
  if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float f = 0.0003 + 0.0010 * dot(c, c);
  vec3 col = vec3(Texel(tex, u + vec2(f, 0.0)).r, Texel(tex, u).g, Texel(tex, u - vec2(f, 0.0)).b);
  float line = 0.5 + 0.5 * sin(sc.y * 3.14159 * (R.y > 900.0 ? 0.5 : 1.0) * 1.0);
  col *= 1.0 - 0.07 * line;
  float vig = smoothstep(1.55, 0.55, length(c));
  col *= mix(0.62, 1.0, vig);
  float fl = 1.0 - 0.04 * step(0.985, fract(sin(floor(T * 7.0)) * 43758.5453));
  return vec4(col * fl, 1.0) * color;
}
]]

-- Card surface: a soft glare that slides opposite the tilt, plus the three
-- Joker finishes (foil, holographic, polychrome) driven by the same tilt.
-- `edition`: 0 none, 1 foil, 2 holographic, 3 polychrome.
local CARD = [[
extern vec2 glare;
extern number sheen;
extern number edition;
extern number T;
extern number glareAmt;
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
vec4 effect(vec4 color, Image tex, vec2 uv, vec2 sc) {
  vec4 px = Texel(tex, uv) * color;
  if (px.a <= 0.0) return px;
  vec3 col = px.rgb;
  float g = exp(-dot(uv - glare, uv - glare) * 9.0);
  col += vec3(1.0) * g * glareAmt;
  if (edition > 2.5) {
    float h = fract(uv.x * 0.7 + uv.y * 0.5 + sheen * 1.2 + sin(uv.y * 9.0 + T) * 0.04);
    col = mix(col, col * 0.55 + hsv(h, 0.55, 1.0) * 0.55, 0.42);
  } else if (edition > 1.5) {
    float band = 0.5 + 0.5 * sin((uv.x + uv.y) * 22.0 + sheen * 18.0);
    float h = fract(uv.x * 0.9 - uv.y * 0.6 + sheen);
    col = mix(col, hsv(h, 0.7, 1.0), 0.20 + 0.18 * band);
  } else if (edition > 0.5) {
    float band = smoothstep(0.35, 0.5, 0.5 + 0.5 * sin((uv.x * 1.2 - uv.y) * 14.0 + sheen * 16.0));
    col = mix(col, vec3(1.0, 0.97, 0.85), 0.10 + 0.32 * band);
  }
  return vec4(col, px.a);
}
]]

local bg, crt, card
function M.background() if not bg then bg = love.graphics.newShader(BACKGROUND) end return bg end
function M.crt() if not crt then crt = love.graphics.newShader(CRT) end return crt end
function M.card() if not card then card = love.graphics.newShader(CARD) end return card end

return M
