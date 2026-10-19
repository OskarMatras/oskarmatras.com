-- Drawing helpers: virtual-resolution scaling, crisp fonts at any window
-- size, rich text (the <i> <em> <u> <b> markup used by the game's strings),
-- rounded and gradient rectangles.
local M = {}

M.W, M.H = 1024, 768   -- virtual size everything is laid out in (it grows to fill wider or taller windows, see resize)
M.BASE_W, M.BASE_H = 1024, 768
M.scale, M.ox, M.oy = 1, 0, 0

local function hex(h, a)
  local r, g, b = h:match('^#?(%x%x)(%x%x)(%x%x)')
  return { tonumber(r, 16) / 255, tonumber(g, 16) / 255, tonumber(b, 16) / 255, a or 1 }
end
M.hex = hex

M.C = {
  felt = hex('#0d2724'), panel = hex('#141d1c'), panel2 = hex('#1d2a29'), panel3 = hex('#263837'), line = hex('#3a5651'),
  ink = hex('#f5efe0'), dim = hex('#a3b5ad'), mute = hex('#71867f'),
  chips = hex('#2f8ff0'), mult = hex('#f0463a'), multDk = hex('#a82820'), gold = hex('#f6b92c'), goldDk = hex('#b07d0e'),
  o = hex('#ff7b3a'), good = hex('#45c67b'), card = hex('#f7f2e7'), cardEdge = hex('#d7cdb8'),
  common = hex('#2f6f9f'), uncommon = hex('#3a9a5f'), rare = hex('#b4423d'), tool = hex('#7a4bb3'), chalk = hex('#2b8f9a'), voucher = hex('#a8742a'),
  black = { 0, 0, 0, 1 }, white = { 1, 1, 1, 1 },
}

function M.alpha(c, a) return { c[1], c[2], c[3], (c[4] or 1) * a } end
function M.mix(a, b, t) return { a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, (a[4] or 1) + ((b[4] or 1) - (a[4] or 1)) * t } end
function M.lighten(c, t) return M.mix(c, M.C.white, t) end
function M.darken(c, t) return M.mix(c, M.C.black, t) end

-- Window / scaling ---------------------------------------------------------
local fontCache = {}
-- UI size: how much of the window the base layout may fill. The layout space is derived from the
-- window, so a big screen shows MORE room rather than a bigger-looking UI, and a small window keeps
-- the base size (scale 1) so text stays readable. M.zoom picks how generous that is (Small/Medium/Large).
M.MAXW, M.MAXH = 1480, 1100
M.zoom = 0.78
M.ZOOMS = { 0.66, 0.78, 0.92 }
function M.resize(w, h)
  w, h = math.max(1, w), math.max(1, h)
  local smax = math.min(w / M.BASE_W, h / M.BASE_H)          -- the largest scale at which the base layout still fits
  local s = math.max(math.min(1, smax), smax * M.zoom)         -- never below scale 1 unless the window is smaller than the base
  -- The layout never spreads wider than MAXW or taller than MAXH (virtual units): on an ultra-wide or very
  -- large screen the extra becomes a margin around a centred layout, not stretched-out panels.
  M.W, M.H = math.min(w / s, M.MAXW), math.min(h / s, M.MAXH)
  M.scale = s
  M.ox, M.oy = math.floor((w - M.W * s) / 2), math.floor((h - M.H * s) / 2)
  fontCache = {}
end
function M.toVirtual(x, y) return (x - M.ox) / M.scale, (y - M.oy) / M.scale end
function M.begin()
  love.graphics.push()
  love.graphics.translate(M.ox, M.oy)
  love.graphics.scale(M.scale, M.scale)
end
function M.finish() love.graphics.pop() end

-- Fonts ----------------------------------------------------------------------
local FILES = {
  ui = 'assets/fonts/Rubik.ttf',
  num = 'assets/fonts/LilitaOne-Regular.ttf',
  pix = 'assets/fonts/Silkscreen-Regular.ttf',
}
local fallback = true
function M.font(name, size)
  local px = math.max(6, math.floor(size * M.scale * (love.graphics.getDPIScale and love.graphics.getDPIScale() or 1) + 0.5))
  local key = name .. ':' .. size .. ':' .. px
  local f = fontCache[key]
  if not f then
    local ok, font = pcall(love.graphics.newFont, FILES[name], px)
    if not ok then font = love.graphics.newFont(px) end
    font:setFilter('linear', 'linear')
    f = { f = font, k = size / px }
    fontCache[key] = f
  end
  return f
end

function M.textWidth(name, size, text)
  local F = M.font(name, size)
  return F.f:getWidth(text) * F.k
end

-- Plain text. align: 'left' | 'center' | 'right' within `limit` (virtual px).
function M.print(name, size, text, x, y, color, align, limit)
  local F = M.font(name, size)
  love.graphics.setFont(F.f)
  love.graphics.setColor(color or M.C.ink)
  local passes = name == 'ui' and 2 or 1   -- Rubik loads at its Light weight; a second faint pass evens it up
  for p = 1, passes do
    local dx = (p - 1) * 0.45
    if limit then
      love.graphics.printf(text, x + dx, y, limit / F.k, align or 'left', 0, F.k, F.k)
    else
      love.graphics.print(text, x + dx, y, 0, F.k, F.k)
    end
  end
end
function M.textHeight(name, size) local F = M.font(name, size); return F.f:getHeight() * F.k end

-- Rich text ---------------------------------------------------------------------
local ENT = { ['&times;'] = '\195\151', ['&amp;'] = '&', ['&lt;'] = '<', ['&gt;'] = '>' }
local richCache = setmetatable({}, { __mode = 'k' })
-- Parse markup into {color, text, color, text, ...}
function M.parseRich(s, base)
  base = base or M.C.ink
  local out, stack = {}, { base }
  local pos = 1
  local function emit(txt)
    if txt == '' then return end
    txt = txt:gsub('&%a+;', ENT)
    out[#out + 1] = stack[#stack]; out[#out + 1] = txt
  end
  while true do
    local a, b, close, tag, attrs = s:find('<(/?)(%a+)([^>]*)>', pos)
    if not a then emit(s:sub(pos)); break end
    emit(s:sub(pos, a - 1))
    if close == '/' then
      if #stack > 1 then stack[#stack] = nil end
    else
      local col = stack[#stack]
      if tag == 'i' then col = M.C.chips
      elseif tag == 'em' then col = M.C.mult
      elseif tag == 'u' then col = M.C.gold
      elseif tag == 'b' then col = M.C.ink
      elseif tag == 'small' then col = M.C.dim
      elseif tag == 'span' then
        if attrs:find('"c"') then col = M.C.chips elseif attrs:find('"m"') then col = M.C.mult
        elseif attrs:find('gold') then col = M.C.gold end
      end
      if tag == 'br' then emit('\n') else stack[#stack + 1] = col end
      if tag == 'br' then stack[#stack] = nil end
    end
    pos = b + 1
  end
  if #out == 0 then out = { base, '' } end
  return out
end

-- Draw markup wrapped to `limit`. Returns the height used.
function M.rich(name, size, markup, x, y, limit, align, base, dry)
  local F = M.font(name, size)
  local parts = M.parseRich(markup, base or M.C.dim)
  local _, lines = F.f:getWrap(parts, limit / F.k)
  local h = #lines * F.f:getHeight() * F.k
  if not dry then
    love.graphics.setFont(F.f)
    love.graphics.setColor(1, 1, 1, 1)
    for p = 1, (name == 'ui' and 2 or 1) do
      love.graphics.printf(parts, x + (p - 1) * 0.45, y, limit / F.k, align or 'left', 0, F.k, F.k)
    end
  end
  return h
end

-- Shapes ----------------------------------------------------------------------------
function M.rrect(mode, x, y, w, h, r, color)
  if color then love.graphics.setColor(color) end
  love.graphics.rectangle(mode, x, y, w, h, r, r, 8)
end

-- Rounded rectangle filled with a vertical gradient (reused mesh).
local gradMesh
local function arcPoints(cx, cy, r, a0, a1, n, out)
  for i = 0, n do
    local a = a0 + (a1 - a0) * i / n
    out[#out + 1] = { cx + math.cos(a) * r, cy + math.sin(a) * r }
  end
end
function M.rrectGrad(x, y, w, h, r, top, bottom, angle)
  r = math.min(r, w / 2, h / 2)
  local pts = {}
  arcPoints(x + w - r, y + r, r, -math.pi / 2, 0, 5, pts)
  arcPoints(x + w - r, y + h - r, r, 0, math.pi / 2, 5, pts)
  arcPoints(x + r, y + h - r, r, math.pi / 2, math.pi, 5, pts)
  arcPoints(x + r, y + r, r, math.pi, math.pi * 1.5, 5, pts)
  local verts = { { x + w / 2, y + h / 2, 0, 0, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2, (top[3] + bottom[3]) / 2, ((top[4] or 1) + (bottom[4] or 1)) / 2 } }
  for _, p in ipairs(pts) do
    local t = (p[2] - y) / h
    if angle == 'diag' then t = ((p[2] - y) / h + (p[1] - x) / w) / 2 end
    verts[#verts + 1] = { p[1], p[2], 0, 0,
      top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t, top[3] + (bottom[3] - top[3]) * t,
      (top[4] or 1) + ((bottom[4] or 1) - (top[4] or 1)) * t }
  end
  verts[#verts + 1] = verts[2]
  if not gradMesh or gradMesh:getVertexCount() < #verts then gradMesh = love.graphics.newMesh(64, 'fan', 'stream') end
  gradMesh:setVertices(verts)
  gradMesh:setDrawRange(1, #verts)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(gradMesh)
end

-- A raised panel: shadow, fill, border.
function M.panel(x, y, w, h, r, fill, border, shadow)
  r = r or 12
  if shadow ~= false then M.rrect('fill', x, y + (shadow or 6), w, h, r, { 0, 0, 0, 0.35 }) end
  M.rrect('fill', x, y, w, h, r, fill or M.C.panel)
  if border then love.graphics.setLineWidth(2); M.rrect('line', x + 1, y + 1, w - 2, h - 2, r, border) end
end

-- A chunky button face (used by the view for every button).
function M.button(x, y, w, h, label, opts)
  opts = opts or {}
  local C = M.C
  local base = opts.color or C.panel3
  local down = opts.down and 3 or 0
  local enabled = opts.enabled ~= false
  local fill = base
  if opts.hover and enabled then fill = M.lighten(base, 0.12) end
  if not enabled then fill = M.alpha(base, 0.42) end
  M.rrect('fill', x, y + 4 - down, w, h, 8, { 0, 0, 0, enabled and 0.35 or 0.15 })
  M.rrect('fill', x, y + down, w, h, 8, fill)
  love.graphics.setColor(0, 0, 0, 0.18)
  love.graphics.rectangle('fill', x + 3, y + down + h - 6, w - 6, 3, 1.5, 1.5)
  local tc = opts.textColor or C.ink
  if not enabled then tc = M.alpha(tc, 0.5) end
  local font, size = opts.font or 'ui', opts.size or 14
  local F = M.font(font, size)
  local th = F.f:getHeight() * F.k
  M.print(font, size, label, x, y + down + (h - th) / 2 - (font == 'ui' and 0 or 1), tc, 'center', w)
end

return M
