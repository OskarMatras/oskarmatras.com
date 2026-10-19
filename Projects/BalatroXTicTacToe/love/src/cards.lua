-- Card feel: every card sways on its own (sin/cos of time, phase-shifted per
-- card), leans toward the pointer when hovered, overshoots in scale on enter,
-- and eases toward every target instead of jumping. A card's face is painted
-- once into a canvas, then drawn as a perspective-warped mesh through the card
-- shader, which adds the glare and the foil / holographic / polychrome finishes.
local gfx = require('src.gfx')
local shaders = require('src.shaders')

local M = {}
M.t = 0
M.dt = 0
M.pointer = { x = -1e4, y = -1e4, active = false }
M.blocked = false          -- true while a modal covers the table
M.reduced = false

local IDLE, HOVER, EASE = 7, 18, 10
local states, canvases = {}, {}
local GRID = 6
local pool = {}

function M.clear() canvases = {} end

local function phaseOf(s)
  local h = 0
  for i = 1, #s do h = (h * 31 + s:byte(i)) % 2147483647 end
  return (h % 628) / 100
end

function M.update(dt, t) M.dt = math.min(dt, 0.05); M.t = t; M.poolIdx = 0 end

-- Face canvas, repainted when `version` changes.
local function face(key, version, w, h, paint)
  local q = math.max(0.5, gfx.scale * (love.graphics.getDPIScale and love.graphics.getDPIScale() or 1))
  local e = canvases[key]
  if e and e.version == version and e.w == w and e.h == h and e.q == q then return e.canvas end
  local cw, ch = math.ceil(w * q), math.ceil(h * q)
  local canvas = e and e.cw == cw and e.ch == ch and e.canvas or love.graphics.newCanvas(cw, ch)
  love.graphics.push('all')
  love.graphics.origin()
  love.graphics.setScissor()
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0, 0, 0, 0)
  love.graphics.setBlendMode('alpha')
  love.graphics.scale(q, q)
  paint(w, h)
  love.graphics.pop()
  canvases[key] = { canvas = canvas, version = version, w = w, h = h, q = q, cw = cw, ch = ch }
  return canvas
end
M.face = face

-- Draw a tilting card.
-- opts: key (stable id for the sway), version (repaint when it changes), edition (0-3),
--       radius, lift (px the card rises), noTilt, scale, rot (extra z rotation), alpha
function M.draw(x, y, w, h, paint, opts)
  opts = opts or {}
  local key = opts.key or 'anon'
  local canvas = face('face:' .. (opts.faceKey or key) .. ':' .. math.floor(w * 10) .. 'x' .. math.floor(h * 10), opts.version or 0, w, h, paint)
  local s = states[key]
  if not s then s = { rx = 0, ry = 0, sc = 1, phase = phaseOf(key), hover = false, punch = -9 }; states[key] = s end

  local p = M.pointer
  local inside = p.active and not M.blocked and not opts.noHover and p.x >= x and p.x <= x + w and p.y >= y and p.y <= y + h
  if inside ~= s.hover then
    s.hover = inside
    if inside then s.punch = M.t end
  end
  local k = 1 - math.exp(-EASE * M.dt)
  local tx, ty = 0, 0
  if not opts.noTilt and not M.reduced then
    local sway = inside and 0.2 or 1
    tx = math.sin(M.t * 1.1 + s.phase) * IDLE * sway
    ty = math.cos(M.t * 0.9 + s.phase) * IDLE * sway
    if inside then
      local nx = ((p.x - x) / w - 0.5) * 2
      local ny = ((p.y - y) / h - 0.5) * 2
      tx = tx - ny * HOVER
      ty = ty + nx * HOVER
    end
  end
  s.rx = s.rx + (tx - s.rx) * k
  s.ry = s.ry + (ty - s.ry) * k
  local wantScale = (inside and 1.08 or 1) * (opts.scale or 1)
  s.sc = s.sc + (wantScale - s.sc) * (1 - math.exp(-14 * M.dt))
  local punch = 0
  local pa = M.t - s.punch
  if pa < 0.32 then punch = math.sin(pa / 0.32 * math.pi * 2) * (1 - pa / 0.32) * 0.07 end

  local cx, cy = x + w / 2, y + h / 2 - (opts.lift or 0)
  -- shadow follows the lean
  local sx, sy = -s.ry * 0.3, 4 + s.rx * 0.2 + (inside and 3 or 0) + (opts.lift or 0) * 0.6
  gfx.rrect('fill', cx - w / 2 * s.sc + sx, cy - h / 2 * s.sc + sy, w * s.sc, h * s.sc, opts.radius or 8, { 0, 0, 0, 0.4 * (opts.alpha or 1) })

  local D = 440
  local crx, srx = math.cos(math.rad(s.rx)), math.sin(math.rad(s.rx))
  local cry, sry = math.cos(math.rad(s.ry)), math.sin(math.rad(s.ry))
  local rz = (opts.rot or 0) + punch
  local crz, srz = math.cos(rz), math.sin(rz)
  -- One mesh per card drawn this frame: re-uploading a shared mesh between
  -- draws in the same frame can show the wrong vertices on some drivers.
  M.poolIdx = (M.poolIdx or 0) + 1
  local mesh = pool[M.poolIdx]
  if not mesh then
    mesh = love.graphics.newMesh(GRID * GRID * 6, 'triangles', 'stream')
    pool[M.poolIdx] = mesh
  end
  local verts = {}
  local function vert(i, j)
    local u, v = i / GRID, j / GRID
    local px, py = (u - 0.5) * w * s.sc, (v - 0.5) * h * s.sc
    local rx2, ry2 = px * crz - py * srz, px * srz + py * crz
    -- rotate about Y then X
    local x1 = rx2 * cry
    local z1 = -rx2 * sry
    local y2 = ry2 * crx - z1 * srx
    local z2 = ry2 * srx + z1 * crx
    local f = D / (D - z2)
    return { cx + x1 * f, cy + y2 * f, u, v }
  end
  local grid = {}
  for j = 0, GRID do for i = 0, GRID do grid[j * (GRID + 1) + i + 1] = vert(i, j) end end
  for j = 0, GRID - 1 do for i = 0, GRID - 1 do
    local a, b = grid[j * (GRID + 1) + i + 1], grid[j * (GRID + 1) + i + 2]
    local c, d = grid[(j + 1) * (GRID + 1) + i + 1], grid[(j + 1) * (GRID + 1) + i + 2]
    verts[#verts + 1] = a; verts[#verts + 1] = b; verts[#verts + 1] = c
    verts[#verts + 1] = b; verts[#verts + 1] = d; verts[#verts + 1] = c
  end end
  mesh:setVertices(verts)
  mesh:setDrawRange(1, #verts)
  mesh:setTexture(canvas)

  local sh = shaders.card()
  sh:send('glare', { 0.5 - s.ry * 0.026, 0.35 + s.rx * 0.026 })
  sh:send('sheen', (s.ry - s.rx) / (HOVER * 2) + 0.5)
  sh:send('edition', opts.edition or 0)
  sh:send('T', M.t)
  sh:send('glareAmt', inside and 0.22 or 0.1)
  love.graphics.setShader(sh)
  love.graphics.setColor(1, 1, 1, opts.alpha or 1)
  love.graphics.draw(mesh)
  love.graphics.setShader()
  return inside
end

return M
