-- Immediate-mode UI plumbing (click regions, buttons, flow layout, tooltips)
-- plus the painters for pieces, Joker cards, items, packs and badges.
local gfx = require('src.gfx')
local data = require('src.data')
local strings = require('src.strings')
local state = require('src.state')
local fx = require('src.fx')
local cards = require('src.cards')

local S = state.S
local C = gfx.C
local t, tr = strings.t, strings.tr

local W = {}

-- Regions ----------------------------------------------------------------------
W.regions, W.prev = {}, {}
W.mouse = { x = -1e4, y = -1e4, down = false }
W.pressed = nil     -- id of the region the button went down on
W.blocked = false   -- while true, regions are not registered (a modal sits on top)
W.tip = nil         -- markup to show as a tooltip this frame

function W.beginFrame()
  W.prev, W.regions = W.regions, {}
  W.tip = nil
  W.hoverId = nil
  local m = W.mouse
  for i = #W.prev, 1, -1 do
    local r = W.prev[i]
    if m.x >= r.x and m.x <= r.x + r.w and m.y >= r.y and m.y <= r.y + r.h then W.hoverId = r.id; W.hoverRegion = r; break end
  end
  if not W.hoverId then W.hoverRegion = nil end
end

function W.region(id, x, y, w, h, fn, tip)
  if W.blocked then return false end
  W.regions[#W.regions + 1] = { id = id, x = x, y = y, w = w, h = h, fn = fn, tip = tip }
  return W.hoverId == id
end
function W.isHover(id) return W.hoverId == id end

function W.mousepressed()
  W.pressed = W.hoverId
end
function W.mousereleased()
  local id, r = W.hoverId, W.hoverRegion
  local fired = false
  if id and id == W.pressed and r and r.fn then r.fn(); fired = true end
  W.pressed = nil
  return fired
end

-- Buttons -------------------------------------------------------------------------
-- opts: color, textColor, font, size, enabled, tip
function W.button(id, x, y, w, h, label, fn, opts)
  opts = opts or {}
  local enabled = opts.enabled ~= false
  local hover = W.region(id, x, y, w, h, enabled and fn or nil, opts.tip)
  gfx.button(x, y, w, h, label, {
    color = opts.color, textColor = opts.textColor, font = opts.font, size = opts.size, enabled = enabled,
    hover = hover, down = hover and W.pressed == id and enabled,
  })
  return hover
end

-- Flow layout ------------------------------------------------------------------------
-- A vertical cursor for building panels. With dry=true nothing is drawn or
-- registered, so the panel can be measured first.
local Flow = {}
Flow.__index = Flow
function W.flow(x, y, w, dry)
  return setmetatable({ x = x, y = y, y0 = y, w = w, dry = dry, n = 0 }, Flow)
end
function Flow:height() return self.y - self.y0 end
function Flow:gap(n) self.y = self.y + n; return self end
function Flow:text(font, size, str, color, align)
  local h = gfx.textHeight(font, size)
  if not self.dry then gfx.print(font, size, str, self.x, self.y, color or C.ink, align or 'left', self.w) end
  self.y = self.y + h
  return self
end
function Flow:rich(size, markup, color, align, font)
  local h = gfx.rich(font or 'ui', size, markup, self.x, self.y, self.w, align or 'left', color or C.dim, self.dry)
  self.y = self.y + h
  return self
end
function Flow:heading(str, color, size)
  return self:text('num', size or 28, str, color or C.ink, 'left'):gap(6)
end
function Flow:row(label, value, valueColor, markupLabel)
  local pad = 10
  local h = 34
  if not self.dry then
    gfx.rrect('fill', self.x, self.y, self.w, h, 8, C.panel2)
    if markupLabel then gfx.rich('ui', 14, label, self.x + pad, self.y + 8, self.w * 0.62, 'left', C.ink)
    else gfx.print('ui', 14, label, self.x + pad, self.y + 8, C.ink) end
    gfx.print('num', 17, value, self.x, self.y + 6, valueColor or C.gold, 'right', self.w - pad)
  end
  self.y = self.y + h + 6
  return self
end
-- Row of buttons, centred, wrapping if needed. items: {id,label,fn,color,textColor,enabled,w,h,font,size}
function Flow:buttons(items, gap)
  gap = gap or 10
  local line, lines = {}, {}
  local lw = 0
  for _, it in ipairs(items) do
    it.w = it.w or math.max(110, gfx.textWidth(it.font or 'ui', it.size or 18, it.label) + 36)
    it.h = it.h or 44
    if lw + it.w + (#line > 0 and gap or 0) > self.w and #line > 0 then lines[#lines + 1] = line; line = {}; lw = 0 end
    lw = lw + it.w + (#line > 0 and gap or 0)
    line[#line + 1] = it
  end
  if #line > 0 then lines[#lines + 1] = line end
  for _, ln in ipairs(lines) do
    local total = -gap
    for _, it in ipairs(ln) do total = total + it.w + gap end
    local x = self.x + (self.w - total) / 2
    local hmax = 0
    for _, it in ipairs(ln) do
      if not self.dry then
        W.button(it.id, x, self.y, it.w, it.h, it.label, it.fn, { color = it.color, textColor = it.textColor, enabled = it.enabled, font = it.font or 'num', size = it.size or 18 })
      end
      x = x + it.w + gap
      hmax = math.max(hmax, it.h)
    end
    self.y = self.y + hmax + 10
  end
  return self
end

-- Piece painter --------------------------------------------------------------------------
-- Face backgrounds follow the web version's look.
local PIECE_BG = {
  plain = { C.card, C.card }, red = { C.card, gfx.hex('#fbd9d5') }, blue = { C.card, gfx.hex('#d7e8fb') },
  gold = { gfx.hex('#fff3c4'), gfx.hex('#e9b93b') }, lucky = { C.card, gfx.hex('#d6f2dc') },
  glass = { gfx.hex('#e1f2ff'), gfx.hex('#bee1fa') }, steel = { gfx.hex('#dfe5e8'), gfx.hex('#aab5ba') },
  bomb = { gfx.hex('#2c2a28'), gfx.hex('#2c2a28') }, ghost = { gfx.hex('#efe6fb'), gfx.hex('#d9c8f2') },
  mirror = { C.card, gfx.hex('#f0d3e4') }, twin = { C.card, gfx.hex('#cdeeea') },
}
-- Draw an X piece filling the square (x, y, s, s).
function W.drawPiece(ty, x, y, s, o)
  o = o or {}
  local P = data.PIECES[ty]
  local bg = PIECE_BG[ty] or PIECE_BG.plain
  local r = math.max(5, s * 0.14)
  local a = o.alpha or 1
  gfx.rrect('fill', x, y + math.max(2, s * 0.05), s, s, r, { 0, 0, 0, 0.35 * a })
  gfx.rrectGrad(x, y, s, s, r, gfx.alpha(bg[1], a), gfx.alpha(bg[2], a))
  love.graphics.setLineWidth(2)
  gfx.rrect('line', x + 1, y + 1, s - 2, s - 2, r, gfx.alpha(C.cardEdge, a))
  local pc = gfx.hex(P.pc)
  -- the X: two chunky strokes with round ends (a soft shadow first)
  local lw = s * 0.15
  local x1, y1, x2, y2 = x + s * 0.27, y + s * 0.2, x + s * 0.73, y + s * 0.66
  local function cross(ox, oy, col)
    love.graphics.setColor(col)
    love.graphics.setLineWidth(lw)
    love.graphics.line(x1 + ox, y1 + oy, x2 + ox, y2 + oy)
    love.graphics.line(x2 + ox, y1 + oy, x1 + ox, y2 + oy)
    for _, p in ipairs({ { x1, y1 }, { x2, y2 }, { x2, y1 }, { x1, y2 } }) do love.graphics.circle('fill', p[1] + ox, p[2] + oy, lw / 2) end
  end
  if ty == 'twin' then cross(s * 0.07, s * 0.05, gfx.alpha(gfx.hex('#1f8f8a'), 0.45 * a)) end
  cross(0, s * 0.04, { 0, 0, 0, 0.18 * a })
  cross(0, 0, gfx.alpha(pc, a))
  local label = tr(P.short)
  if label ~= '' and s >= 36 then
    local lh = math.max(8, s * 0.17)
    local fs = math.max(6.5, s * 0.115)
    love.graphics.setColor(gfx.alpha(pc, a))
    love.graphics.rectangle('fill', x + 1, y + s - lh - 1, s - 2, lh, 0, 0)
    gfx.print('ui', fs, label, x, y + s - lh - 1 + (lh - gfx.textHeight('ui', fs)) / 2, gfx.alpha(C.white, a), 'center', s)
  end
  if o.shattered then gfx.rrect('fill', x, y, s, s, r, { 0.1, 0.12, 0.12, 0.6 }) end
end

-- Joker / item / pack faces -------------------------------------------------------------------
function W.monogram(name)
  local words = {}
  for w in name:gmatch('%S+') do words[#words + 1] = w end
  if #words >= 2 then return (words[1]:sub(1, 1) .. words[2]:sub(1, 1)):upper() end
  local w = words[1] or '?'
  return w:sub(1, 1):upper() .. w:sub(2, 2):lower()
end

local RARITY_COL = { [1] = C.common, [2] = C.uncommon, [3] = C.rare }
function W.rarityColor(r) return RARITY_COL[r] end

function W.paintJoker(id, val)
  return function(w, h)
    local d = data.JOKERS[id]
    local jc = RARITY_COL[d.rar]
    gfx.rrectGrad(0, 0, w, h, 8, gfx.mix(jc, C.white, 0.22), gfx.mix(jc, C.black, 0.3), 'diag')
    love.graphics.setColor(1, 1, 1, 0.14); love.graphics.setLineWidth(3)
    love.graphics.rectangle('line', 2, 2, w - 4, h - 4, 7, 7)
    local mono = W.monogram(d.name)
    local sz = w * 0.38
    local F = gfx.font('num', sz)
    local th = F.f:getHeight() * F.k
    gfx.print('num', sz, mono, 0, h * 0.14 + 3, { 0, 0, 0, 0.35 }, 'center', w)
    gfx.print('num', sz, mono, 0, h * 0.14, C.white, 'center', w)
    local ns = math.max(7.5, w * 0.125)
    love.graphics.setColor(0, 0, 0, 0.18); love.graphics.rectangle('fill', 3, h * 0.60, w - 6, h * 0.4 - 3, 4, 4)
    gfx.rich('ui', ns, '<b>' .. d.name .. '</b>', 4, h * 0.63, w - 8, 'center', C.white)
    if val then gfx.print('num', math.max(9, w * 0.17), val, 0, h - math.max(9, w * 0.17) - 7, C.gold, 'center', w) end
  end
end

local function bar(x, y, w, h) love.graphics.rectangle('fill', x, y, w, h, h / 2, h / 2) end
function W.paintItem(id)
  return function(w, h)
    local d = data.ITEMS[id]
    local col = d.kind == 'chalk' and C.chalk or C.tool
    gfx.rrectGrad(0, 0, w, h, 8, gfx.mix(col, C.white, 0.2), gfx.mix(col, C.black, 0.25), 'diag')
    love.graphics.setColor(1, 1, 1, 0.14); love.graphics.setLineWidth(3)
    love.graphics.rectangle('line', 2, 2, w - 4, h - 4, 7, 7)
    local cx, cy, u = w / 2, h * 0.38, w * 0.2
    love.graphics.setColor(1, 1, 1, 0.95)
    love.graphics.setLineWidth(math.max(3, w * 0.07))
    love.graphics.setLineStyle('smooth')
    if id == 'chalk_row' then bar(cx - u * 1.4, cy - u * 0.5, u * 2.8, u * 0.32); bar(cx - u * 1.4, cy + u * 0.2, u * 2.8, u * 0.32)
    elseif id == 'chalk_col' then bar(cx - u * 0.5, cy - u * 1.3, u * 0.32, u * 2.6); bar(cx + u * 0.2, cy - u * 1.3, u * 0.32, u * 2.6)
    elseif id == 'chalk_diag' then love.graphics.line(cx - u, cy - u, cx + u, cy + u); love.graphics.line(cx - u * 0.4, cy - u * 1.2, cx + u * 1.2, cy + u * 0.4)
    elseif id == 'chalk_draw' then bar(cx - u * 1.2, cy - u * 0.55, u * 2.4, u * 0.34); bar(cx - u * 1.2, cy + u * 0.2, u * 2.4, u * 0.34)
    elseif id == 'eraser' then
      love.graphics.push(); love.graphics.translate(cx, cy); love.graphics.rotate(-0.5)
      love.graphics.rectangle('fill', -u * 1.2, -u * 0.6, u * 2.4, u * 1.2, 3, 3)
      love.graphics.setColor(0.9, 0.3, 0.35, 1); love.graphics.rectangle('fill', -u * 1.2, -u * 0.6, u * 1.0, u * 1.2, 3, 3)
      love.graphics.pop()
    elseif id == 'sprint' then
      love.graphics.line(cx - u * 1.1, cy - u * 0.8, cx - u * 0.2, cy, cx - u * 1.1, cy + u * 0.8)
      love.graphics.line(cx + u * 0.1, cy - u * 0.8, cx + u * 1.0, cy, cx + u * 0.1, cy + u * 0.8)
    elseif id == 'forge' then
      love.graphics.rectangle('fill', cx - u * 0.9, cy - u * 0.9, u * 1.8, u * 0.7, 3, 3)
      love.graphics.rectangle('fill', cx - u * 0.25, cy - u * 0.3, u * 0.5, u * 1.3, 2, 2)
    else
      gfx.print('num', w * 0.3, '$$', 0, cy - w * 0.17, C.white, 'center', w)
    end
    local ns = math.max(7.5, w * 0.115)
    love.graphics.setColor(0, 0, 0, 0.18); love.graphics.rectangle('fill', 3, h * 0.64, w - 6, h * 0.36 - 3, 4, 4)
    gfx.rich('ui', ns, '<b>' .. tr(d.name) .. '</b>', 4, h * 0.67, w - 8, 'center', C.white)
  end
end

function W.paintPack(ty)
  return function(w, h)
    local P = data.PACKS[ty]
    local col = gfx.hex(P.color)
    gfx.rrectGrad(0, 0, w, h, 8, gfx.mix(col, C.white, 0.25), gfx.mix(col, C.black, 0.3), 'diag')
    love.graphics.setColor(1, 1, 1, 0.16); love.graphics.setLineWidth(3)
    love.graphics.rectangle('line', 2, 2, w - 4, h - 4, 7, 7)
    local letter = ({ joker = 'J', piece = 'X', chalk = 'C', builder = 'B', tool = 'T' })[ty] or '?'
    gfx.print('num', w * 0.46, letter, 0, h * 0.1 + 3, { 0, 0, 0, 0.3 }, 'center', w)
    gfx.print('num', w * 0.46, letter, 0, h * 0.1, C.white, 'center', w)
    gfx.rich('ui', math.max(8, w * 0.125), '<b>' .. tr(P.name) .. '</b>', 4, h * 0.72, w - 8, 'center', C.white)
  end
end

local TILE_COL = { hot = C.mult, rich = C.chips, gild = C.gold, echo = gfx.hex('#1f8f8a') }
function W.tileBadgeText(k, l)
  if k == 'echo' then return 'x' .. (l + 1) end
  return data.TILE_BADGE[k](l)
end
function W.drawBadge(k, l, x, y, size)
  local txt = W.tileBadgeText(k, l)
  local fw = gfx.textWidth('num', size, txt)
  local bw, bh = fw + size * 0.5, size * 1.25
  gfx.rrect('fill', x, y + 1, bw, bh, 4, { 0, 0, 0, 0.4 })
  gfx.rrect('fill', x, y, bw, bh, 4, TILE_COL[k])
  gfx.print('num', size, txt, x, y + (bh - gfx.textHeight('num', size)) / 2, k == 'gild' and gfx.hex('#2a1d00') or C.white, 'center', bw)
  return bw
end
function W.paintTile(k)
  return function(w, h)
    gfx.rrectGrad(0, 0, w, h, 8, C.panel3, C.panel2, 'diag')
    love.graphics.setColor(1, 1, 1, 0.12); love.graphics.setLineWidth(3)
    love.graphics.rectangle('line', 2, 2, w - 4, h - 4, 7, 7)
    local txt = W.tileBadgeText(k, 1)
    local size = w * 0.3
    local bw = gfx.textWidth('num', size, txt) + size * 0.5
    W.drawBadge(k, 1, (w - bw) / 2, h * 0.3, size)
  end
end
function W.paintVoucher(id)
  return function(w, h)
    local d = data.VOUCHERS[id]
    gfx.rrectGrad(0, 0, w, h, 8, gfx.mix(C.voucher, C.white, 0.2), gfx.mix(C.voucher, C.black, 0.3), 'diag')
    love.graphics.setColor(1, 1, 1, 0.14); love.graphics.setLineWidth(3)
    love.graphics.rectangle('line', 2, 2, w - 4, h - 4, 7, 7)
    gfx.print('num', w * 0.3, d.gl, 0, h * 0.28, C.white, 'center', w)
  end
end

-- Tooltip -----------------------------------------------------------------------------------
function W.drawTip()
  local tip = W.tip
  if not tip then return end
  local m = W.mouse
  local wmax = 260
  local h = gfx.rich('ui', 13, tip, 0, 0, wmax - 20, 'left', C.dim, true)
  local w = wmax
  local x = math.max(8, math.min(gfx.W - w - 8, m.x - w / 2))
  local y = m.y - h - 34
  if y < 8 then y = m.y + 24 end
  gfx.panel(x, y, w, h + 16, 8, C.panel, C.line, 4)
  gfx.rich('ui', 13, tip, x + 10, y + 8, w - 20, 'left', C.dim)
end

return W
