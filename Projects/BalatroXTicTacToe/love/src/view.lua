-- Everything you see: sidebar, rack, the play / blind / shop stages, overlays,
-- popups. Immediate mode: the whole picture is drawn from the run state `S`
-- each frame; clicks go through the regions that W.region registers while
-- drawing. Layout is in a fixed 1024x768 space (see gfx.lua).
local gfx = require('src.gfx')
local W = require('src.widgets')
local fx = require('src.fx')
local cards = require('src.cards')
local state = require('src.state')
local data = require('src.data')
local rules = require('src.rules')
local geometry = require('src.geometry')
local strings = require('src.strings')
local engine = require('src.engine')
local util = require('src.util')

local S, SET = state.S, state.SET
local C = gfx.C
local t, tr, fmt, fmtM = strings.t, strings.tr, strings.fmt, strings.fmtM
local hasJ = data.hasJ

local V = {}
V.modal = nil        -- 'info' | 'bag' | nil (phase overlays come from S.phase)
V.insp = nil         -- inspector popover { kind, uid, ax, ay, aw, ah }
V.abandonArmed = false
V.scroll = 0
V.lastPhase = nil
V.cashT0 = 0
V.packT0 = 0
V.hooks = {}         -- set by app.lua: fullscreen toggle, language toggle

local SIDE = { x = 12, y = 12, w = 236, h = 744 }
local RACK = { x = 264, y = 12, w = 748, h = 152 }
local STAGE = { x = 264, y = 172, w = 748, h = 584 }
-- The window can be any shape (gfx.W x gfx.H follows it), so the three regions are re-derived every frame.
local function relayout()
  SIDE.h = gfx.H - 24
  RACK.w = gfx.W - RACK.x - 12
  STAGE.w = gfx.W - STAGE.x - 12
  STAGE.h = gfx.H - STAGE.y - 12
end

local function act(name, arg)
  return function() V.insp = nil; engine.actions[name](arg) end
end
local function local_(fn) return function() V.insp = nil; fn() end end

function V.showModal(kind) V.modal = kind; V.abandonArmed = false end

local function jokerTip(j)
  local d, ed = data.JOKERS[j.id], j.ed and data.EDITIONS[j.ed]
  local s = '<b>' .. d.name .. '</b>\n' .. tr(data.jokerDesc(j.id, j))
  if ed then s = s .. '\n<u>' .. tr(ed.name) .. ':</u> ' .. tr(ed.desc) end
  return s
end
local function itemDescText(d)
  if d.kind ~= 'chalk' then return tr(d.desc) end
  local L = data.LINE_TYPES[d.lt]
  return t('chalk.desc', { name = tr(L.name), c = L.dc, m = L.dm })
end
V.itemDescText = itemDescText

--[[ =====================================================================
   Sidebar
   ===================================================================== ]]
local function bumpScale(which)
  local age = fx.t - fx.bump[which]
  if age < 0.09 then return 1 + 0.12 * (1 - age / 0.09) end
  return 1
end

local function sideBox(x, y, w, h, fill) gfx.rrect('fill', x, y, w, h, 10, fill or C.panel2) end

local function drawSide()
  local inPlay = S.phase == 'play' and S.round
  local x, y, w, h = SIDE.x, SIDE.y, SIDE.w, SIDE.h
  gfx.panel(x, y, w, h, 14, gfx.alpha(C.panel, 0.94), C.line, 6)
  local px, pw = x + 10, w - 20
  local cy = y + 10

  -- blind tag
  local col, name, desc, label, value, valueCol, reward
  if inPlay then
    local b = rules.blindInfo(S.blindIdx)
    col, name, desc, label, value, valueCol, reward = gfx.hex(b.color), b.name, b.desc, t('ui.scoreAtLeast'), fmt(S.round.target), C.mult, ('$'):rep(b.reward)
  elseif S.phase == 'shop' or S.phase == 'cashout' or S.phase == 'won' then
    col, name, desc, label, value, valueCol = C.voucher, t('ui.shop'), t('ui.shopDesc'), t('ui.nextUp'), rules.blindInfo(S.blindIdx).name, C.ink
  else
    col, name, desc, label, value, valueCol = C.panel3, t('ui.chooseBlind'), t('ui.anteN', { n = S.ante }), t('ui.nextTarget'), fmt(rules.blindInfo(S.blindIdx).target), C.mult
  end
  local th = 112
  gfx.rrect('fill', px, cy, pw, th, 10, col)
  love.graphics.setColor(0, 0, 0, 0.25); love.graphics.rectangle('fill', px + 4, cy + th - 5, pw - 8, 4, 2, 2)
  gfx.print('num', 20, name, px + 10, cy + 6 + 2, { 0, 0, 0, 0.4 }, 'left', pw - 20)
  gfx.print('num', 20, name, px + 10, cy + 6, C.white, 'left', pw - 20)
  gfx.rich('ui', 12, desc, px + 10, cy + 31, pw - 20, 'left', gfx.alpha(C.white, 0.92))
  love.graphics.setColor(0, 0, 0, 0.28)
  love.graphics.rectangle('fill', px + 6, cy + th - 40, pw - 12, 32, 8, 8)
  gfx.print('ui', 11, label, px + 12, cy + th - 31, C.dim)
  local vsz = valueCol == C.ink and 15 or 24
  gfx.print('num', vsz, value, px + 12, cy + th - 40 + (32 - gfx.textHeight('num', vsz)) / 2, valueCol, 'right', pw - 24 - (reward and 40 or 0))
  if reward then gfx.print('ui', 13, reward, px + 12, cy + th - 31, C.gold, 'right', pw - 24) end
  cy = cy + th + 8

  -- round score
  sideBox(px, cy, pw, 46)
  gfx.print('ui', 13, t('ui.roundScore'), px + 10, cy + 15, C.dim)
  local shown = inPlay and (fx.scoreOverride or S.round.score) or 0
  gfx.print('num', 28, fmt(shown), px, cy + 6, C.ink, 'right', pw - 10)
  cy = cy + 54

  -- calc: label, chips x mult
  sideBox(px, cy, pw, 84)
  local c = fx.calc
  if c.total then
    gfx.print('num', 17, '+' .. fmt(c.total), px, cy + 6, C.gold, 'center', pw)
  elseif c.label then
    local nm, lv = c.label.name, c.label.lvl
    local nw, lw = gfx.textWidth('num', 16, nm), gfx.textWidth('ui', 11, ' ' .. lv)
    local sx = px + (pw - nw - lw) / 2
    gfx.print('num', 16, nm, sx, cy + 6, C.ink)
    gfx.print('ui', 11, ' ' .. lv, sx + nw, cy + 10, C.dim)
  end
  local bw = (pw - 16 - 30) / 2
  local function calcBox(bx, which, val, colr, tcolor)
    local sc = bumpScale(which)
    love.graphics.push()
    love.graphics.translate(bx + bw / 2, cy + 52)
    love.graphics.scale(sc, sc)
    gfx.rrect('fill', -bw / 2, -18, bw, 36, 8, colr)
    love.graphics.setColor(0, 0, 0, 0.25); love.graphics.rectangle('fill', -bw / 2 + 3, 12, bw - 6, 4, 2, 2)
    gfx.print('num', 25, val, -bw / 2, -17, C.white, which == 'chips' and 'right' or 'left', bw - (which == 'chips' and 8 or -8))
    love.graphics.pop()
  end
  calcBox(px + 8, 'chips', fmt(c.chips), C.chips)
  calcBox(px + 8 + bw + 30, 'mult', fmtM(c.mult), C.mult)
  gfx.print('num', 20, 'X', px + 8 + bw, cy + 40, C.mult, 'center', 30)
  cy = cy + 92

  -- stats
  local sw = (pw - 6) / 2
  local function stat(sx, sy, lab, val, colr)
    sideBox(sx, sy, sw, 50)
    gfx.print('ui', 11, lab, sx, sy + 4, C.dim, 'center', sw)
    gfx.print('num', 24, val, sx, sy + 17, colr or C.ink, 'center', sw)
  end
  stat(px, cy, t('ui.games'), tostring(inPlay and S.round.games or S.maxGames), C.chips)
  stat(px + sw + 6, cy, t('ui.discards'), tostring(inPlay and S.round.discards or S.maxDiscards), C.mult)
  cy = cy + 56
  stat(px, cy, t('ui.ante'), S.ante .. '/8')
  stat(px + sw + 6, cy, t('ui.round'), tostring((S.ante - 1) * 3 + S.blindIdx + 1))
  cy = cy + 56

  -- money
  sideBox(px, cy, pw, 52)
  gfx.print('num', 34, '$' .. S.money, px, cy + 6 + 2, C.goldDk, 'center', pw)
  gfx.print('num', 34, '$' .. S.money, px, cy + 6, C.gold, 'center', pw)
  cy = cy + 60

  -- buttons
  local bw2 = (pw - 6) / 2
  local function btn(i, id, label, fn, color)
    local col_, row = (i - 1) % 2, math.floor((i - 1) / 2)
    W.button(id, px + col_ * (bw2 + 6), cy + row * 38, bw2, 32, label, fn, { color = color, size = 13 })
  end
  btn(1, 'b-info', t('ui.runInfo'), local_(function() V.showModal('info') end), C.mult)
  btn(2, 'b-bag', t('ui.bag'), local_(function() V.showModal('bag') end))
  btn(3, 'b-speed', t('ui.speed', { n = SET.speed }), act('toggleSpeed'))
  btn(4, 'b-sound', SET.sound and t('ui.soundOn') or t('ui.soundOff'), act('toggleSound'))
  btn(5, 'b-crt', SET.crt and t('ui.crtOn') or t('ui.crtOff'), act('toggleCrt'))
  btn(6, 'b-lang', strings.getLang() == 'da' and 'Dansk' or 'English', local_(function() if V.hooks.toggleLang then V.hooks.toggleLang() end end))
  btn(8, 'b-size', t('ui.uiSize', { n = t('ui.size' .. (SET.uiSize or 2)) }), local_(function() if V.hooks.cycleUiSize then V.hooks.cycleUiSize() end end))
  btn(7, 'b-full', love.window.getFullscreen() and 'Window' or 'Fullscreen', local_(function() if V.hooks.toggleFullscreen then V.hooks.toggleFullscreen() end end))
end

--[[ =====================================================================
   Rack (Jokers and items)
   ===================================================================== ]]
local function tray(x, y, w, h, label, count, slots)
  gfx.rrect('fill', x, y, w, h, 12, { 0, 0, 0, 0.28 })
  love.graphics.setColor(1, 1, 1, 0.08); love.graphics.setLineWidth(2)
  love.graphics.rectangle('line', x + 1, y + 1, w - 2, h - 2, 12, 12)
  gfx.print('ui', 11, label, x + 10, y + 6, C.dim)
  gfx.print('ui', 11, count .. '/' .. slots, x, y + 6, C.dim, 'right', w - 10)
end

local function inspectAnchor(kind, uid, r) V.insp = { kind = kind, uid = uid, ax = r.x, ay = r.y, aw = r.w, ah = r.h } end

local function drawRack()
  local L = fx.layout
  L.jokers, L.items = {}, {}
  local jw = 408 + 152
  tray(RACK.x, RACK.y, jw, RACK.h, t('ui.jokers'), #S.jokers, S.jokerSlots)
  local n = math.max(#S.jokers, S.jokerSlots)
  local cw = math.min(74, (jw - 24 - 8 * (n - 1)) / n)
  local ch = cw * 1.28
  local x0, y0 = RACK.x + 12, RACK.y + 30
  if #S.jokers == 0 then
    gfx.rich('ui', 12, t('ui.noJokers'), x0 + 4, y0 + 8, jw - 40, 'left', C.mute)
  end
  for i, j in ipairs(S.jokers) do
    local d = data.JOKERS[j.id]
    local x = x0 + (i - 1) * (cw + 8)
    local val = d.val and d.val(j) or nil
    local age = fx.t - (fx.jig['j' .. j.uid] or -9)
    local sc = age < 0.32 and (1 + 0.16 * math.sin(age / 0.32 * math.pi)) or 1
    local rect = { x = x, y = y0, w = cw, h = ch }
    L.jokers[j.uid] = rect
    local edn = ({ foil = 1, holo = 2, poly = 3 })[j.ed or ''] or 0
    cards.draw(x, y0, cw, ch, W.paintJoker(j.id, val), { key = 'j' .. j.uid, faceKey = 'joker:' .. j.id, version = tostring(val), edition = edn, scale = sc, noHover = W.blocked })
    W.region('joker' .. j.uid, x, y0, cw, ch, function() inspectAnchor('joker', j.uid, rect) end, jokerTip(j))
  end

  local ix = RACK.x + jw + 10
  local iw = RACK.w - jw - 10
  tray(ix, RACK.y, iw, RACK.h, t('ui.items'), #S.items, S.itemSlots)
  local m = math.max(#S.items, S.itemSlots)
  local icw = math.min(74, (iw - 24 - 8 * (m - 1)) / m)
  local ich = icw * 1.28
  for i, it in ipairs(S.items) do
    local x = ix + 12 + (i - 1) * (icw + 8)
    local rect = { x = x, y = y0, w = icw, h = ich }
    L.items[it.uid] = rect
    cards.draw(x, y0, icw, ich, W.paintItem(it.id), { key = 'c' .. it.uid, faceKey = 'item:' .. it.id, version = 0, noHover = W.blocked })
    local d = data.ITEMS[it.id]
    W.region('item' .. it.uid, x, y0, icw, ich, function() inspectAnchor('item', it.uid, rect) end, '<b>' .. tr(d.name) .. '</b>\n' .. itemDescText(d))
  end
end

--[[ =====================================================================
   Play stage
   ===================================================================== ]]
local function drawO(cx, cy, size, a)
  local r = size * 0.32
  local lw = math.max(5, size * 0.16)
  love.graphics.setLineWidth(lw)
  love.graphics.setColor(0.54, 0.21, 0.06, a)
  love.graphics.circle('line', cx, cy + size * 0.05, r, 40)
  love.graphics.setColor(1, 0.482, 0.227, a)
  love.graphics.circle('line', cx, cy, r, 40)
end

local function drawStone(x, y, s)
  gfx.rrect('fill', x, y, s, s, 8, gfx.hex('#566160'))
  love.graphics.setColor(0.31, 0.35, 0.34, 1)
  love.graphics.setScissor()
  for k = -s, s, 14 do
    love.graphics.setLineWidth(5)
    love.graphics.setColor(0.38, 0.41, 0.4, 1)
    love.graphics.line(x + math.max(0, k), y + math.max(0, -k) + 0, x + math.min(s, k + s), y + math.min(s, s - k))
  end
  love.graphics.setColor(0, 0, 0, 0.3); love.graphics.rectangle('fill', x + 2, y + s - 6, s - 4, 4, 2, 2)
  gfx.print('pix', math.max(7, s * 0.2), t('stone'), x, y + s / 2 - gfx.textHeight('pix', s * 0.2) / 2, gfx.hex('#c9d0cd'), 'center', s)
end

-- The board (also used by the square-upgrade picker). `click(i)` is called for a cell press.
local function drawBoard(bx, by, size, board, opts)
  opts = opts or {}
  local N = S.N
  local L = fx.layout
  L.board = { x = bx, y = by, w = size, h = size }
  gfx.rrect('fill', bx, by, size, size, 16, { 0, 0, 0, 0.25 })
  love.graphics.setColor(1, 1, 1, 0.07); love.graphics.setLineWidth(2)
  love.graphics.rectangle('line', bx + 1, by + 1, size - 2, size - 2, 16, 16)
  local pad = 10
  local cell = (size - pad * 2) / N
  local inset = math.max(2, math.min(6, cell * 0.06))
  local armed = opts.armed
  local pulse = 0.5 + 0.5 * math.sin(fx.t * 7.5)
  for i = 1, N * N do
    local r, c = geometry.rc(i)
    local cx, cy = bx + pad + c * cell, by + pad + r * cell
    local x, y, s = cx + inset, cy + inset, cell - inset * 2
    L.cells[i] = { x = x, y = y, w = s, h = s }
    local cellv = board[i]
    local sq = geometry.squareOf(i)
    local hasUp = next(sq) ~= nil
    local empty = not cellv
    local hover = false
    if opts.click and not W.blocked then
      local clickable = opts.clickable and opts.clickable(i, cellv) or false
      if clickable then
        hover = W.region('cell' .. i, x, y, s, s, function() opts.click(i) end)
      end
    end
    -- slot
    local fill = { 1, 1, 1, 0.05 }
    local border = { 1, 1, 1, 0.08 }
    if hasUp then fill = { 0.965, 0.725, 0.173, 0.06 } end
    if armed and empty then border = { 0.965, 0.725, 0.173, 0.45 } end
    if hover and (armed and empty or opts.tiling or opts.erasing) then fill = { 0.965, 0.725, 0.173, 0.2 }; border = C.gold end
    if opts.tiling or (opts.erasing and cellv and cellv.t == 'O') then border = gfx.alpha(C.gold, 0.5 + 0.5 * pulse); fill = { 0.965, 0.725, 0.173, 0.08 + 0.1 * pulse } end
    gfx.rrect('fill', x, y, s, s, math.max(6, s * 0.12), fill)
    love.graphics.setLineWidth(2)
    gfx.rrect('line', x + 1, y + 1, s - 2, s - 2, math.max(6, s * 0.12), border)
    -- upgrade badges
    local bxo = x + 3
    for _, k in ipairs(data.TILES_ORDER) do
      if sq[k] then
        local bwid = W.drawBadge(k, sq[k], bxo, y + 3, math.max(9, s * 0.14))
        bxo = bxo + bwid + 2
      end
    end
    -- contents
    if cellv then
      local anim = fx.cellAnim[i]
      local pa = anim and (fx.t - anim) or 1
      local scale = pa < 0.25 and (0.2 + 0.8 * fx.easeOutBack(pa / 0.25, 1.6)) or 1
      local flags = fx.cellFlag[i] or {}
      local px, py, ps = x + 3, y + 3, s - 6
      love.graphics.push()
      love.graphics.translate(x + s / 2, y + s / 2)
      love.graphics.scale(scale, scale)
      love.graphics.translate(-(x + s / 2), -(y + s / 2))
      if cellv.t == 'X' then
        local lift = flags.scoring and -3 or 0
        local ps2 = flags.scoring and ps * 1.05 or ps
        local off = (ps - ps2) / 2
        if flags.scoring then
          love.graphics.setLineWidth(4); gfx.rrect('line', px + off - 2, py + off + lift - 2, ps2 + 4, ps2 + 4, 10, C.gold)
        elseif flags.held then
          love.graphics.setLineWidth(3); gfx.rrect('line', px - 1, py - 1, ps + 2, ps + 2, 10, gfx.hex('#9fb2bb'))
        end
        W.drawPiece(cellv.p.type, px + off, py + off + lift, ps2, { shattered = cellv.shattered, alpha = cellv.shattered and 0.45 or 1 })
        if opts.tips then W.region('xp' .. i, x, y, s, s, nil, '<b>' .. tr(data.PIECES[cellv.p.type].name) .. '</b>\n' .. tr(data.PIECES[cellv.p.type].desc)) end
      elseif cellv.t == 'O' then
        drawO(x + s / 2, y + s / 2, s, 1)
      else
        drawStone(x + 3, y + 3, s - 6)
      end
      love.graphics.pop()
    end
  end
  -- strikes through scored lines
  if opts.strikes and S.g then
    local G = geometry.geo()
    love.graphics.setLineWidth(math.max(4, cell * 0.08))
    love.graphics.setLineStyle('smooth')
    for _, li in ipairs(S.g.scored) do
      local l = G.lines[li]
      local function pt(i) local r, c = geometry.rc(i); return bx + pad + (c + 0.5) * cell, by + pad + (r + 0.5) * cell end
      local x1, y1 = pt(l.cells[1])
      local x2, y2 = pt(l.cells[3])
      local dx, dy = (x2 - x1) * 0.12, (y2 - y1) * 0.12
      love.graphics.setColor(C.gold[1], C.gold[2], C.gold[3], 0.8)
      love.graphics.line(x1 - dx, y1 - dy, x2 + dx, y2 + dy)
      love.graphics.circle('fill', x1 - dx, y1 - dy, math.max(2, cell * 0.04))
      love.graphics.circle('fill', x2 + dx, y2 + dy, math.max(2, cell * 0.04))
    end
  end
end

local function drawBanner(bx, by, size)
  local b = fx.banner
  if not b then return end
  local age = fx.t - b.t0
  local k = age < 0.28 and fx.easeOutBack(age / 0.28, 2) or 1
  local f = math.max(14, math.min(24, size / 18))
  local tw = gfx.textWidth('num', f + 4, b.text) + 36
  local th = gfx.textHeight('num', f + 4) + 22
  love.graphics.push()
  love.graphics.translate(bx + size / 2, by + size / 2)
  love.graphics.scale(k, k)
  gfx.rrect('fill', -tw / 2, -th / 2 + 8, tw, th, 12, { 0, 0, 0, 0.4 })
  gfx.rrect('fill', -tw / 2, -th / 2, tw, th, 12, C.panel)
  love.graphics.setLineWidth(3)
  gfx.rrect('line', -tw / 2, -th / 2, tw, th, 12, b.bad and C.mult or C.gold)
  gfx.print('num', f + 4, b.text, -tw / 2, -th / 2 + 10, b.bad and gfx.hex('#ffd9d4') or C.ink, 'center', tw)
  love.graphics.pop()
end

local function drawPlay()
  local N = S.N
  local armed = not S.busy and not S.mode and #S.hand > 0
  local size = math.max(300, math.min(STAGE.h - 180, STAGE.w - 40, 620))
  local bx, by = STAGE.x + (STAGE.w - size) / 2, STAGE.y + 2
  local erasing = S.mode == 'erase'
  drawBoard(bx, by, size, S.board, {
    armed = armed, erasing = erasing, strikes = true, tips = true,
    clickable = function(i, c)
      if erasing then return c and c.t == 'O' end
      return armed and not c
    end,
    click = function(i) V.insp = nil; engine.actions.cell(i) end,
  })
  drawBanner(bx, by, size)
  if erasing then
    local msg = t('hint.erase')
    local tw = 420
    gfx.rrect('fill', bx + (size - tw) / 2, by - 2, tw, 34, 10, gfx.alpha(C.panel, 0.95))
    gfx.rich('ui', 13, msg, bx + (size - tw) / 2 + 12, by + 6, tw - 90, 'left', C.ink)
    W.button('cancelmode', bx + (size + tw) / 2 - 82, by + 2, 74, 26, t('btn.cancel'), act('cancelMode'), { size = 12 })
  end

  -- meta line
  local my = by + size + 8
  local rnd = S.round
  gfx.print('ui', 12, t('meta.game', { n = rnd.gameNo, m = rnd.gameNo + rnd.games - 1 }), STAGE.x + 80, my, C.dim)
  gfx.print('ui', 12, hasJ('overtime') and t('meta.overtime') or t('meta.firstLine'), STAGE.x, my, C.dim, 'center', STAGE.w)
  gfx.print('ui', 12, t('meta.bag', { n = #S.g.pile }), STAGE.x, my, C.dim, 'right', STAGE.w - 80)

  -- hand
  local hy = my + 22
  local ps = 72
  local n = #S.hand
  local gap = 10
  local total = n * ps + math.max(0, n - 1) * gap
  local hx = STAGE.x + STAGE.w / 2 - total / 2 - 70
  for k, p in ipairs(S.hand) do
    local x = hx + (k - 1) * (ps + gap)
    local fan = k - (n + 1) / 2
    local sel = k == S.selIdx
    local dealt = fx.dealt[p]
    local lift, rot, sc, alpha, ox, oy = 0, math.rad(fan * 5), 1, 1, 0, fan * fan * 2.5
    if sel then rot = 0; lift = 14; oy = 0 end
    if dealt then
      local age = fx.t - dealt - k * 0.07
      if age < 0 then alpha = 0; ox, oy, rot, sc = 140, 110, math.rad(38), 0.55
      elseif age < 0.5 then
        local e = fx.easeOutBack(age / 0.5, 1.5)
        ox, oy = 140 * (1 - e), 110 * (1 - e) + oy * e
        rot = math.rad(38) * (1 - e) + rot * e
        sc = 0.55 + 0.45 * e
        alpha = math.min(1, age / 0.15)
      else fx.dealt[p] = nil end
    end
    local type_ = p.type
    local dy = hy + oy - lift
    if sel then
      love.graphics.setLineWidth(3)
      gfx.rrect('line', x - 3 + ox, dy - 3, ps + 6, ps + 6, 11, gfx.alpha(C.gold, alpha))
    end
    cards.draw(x + ox, dy + lift, ps, ps, function(w, h) W.drawPiece(type_, 0, 0, w, {}) end,
      { key = 'h' .. k .. (p.uid or 0), faceKey = 'piece:' .. type_ .. ':' .. ps, version = 0, rot = rot, scale = sc, lift = lift, alpha = alpha, noTilt = false, radius = 10 })
    local P = data.PIECES[type_]
    W.region('hand' .. k, x, dy - 4, ps, ps + 8, act('selectPiece', k), '<b>' .. tr(P.name) .. '</b>\n' .. tr(P.desc))
  end
  -- discard
  local noSpecials = true
  for _, p in ipairs(S.hand) do if p.type ~= 'plain' then noSpecials = false end end
  for _, p in ipairs(S.g.pile) do if p.type ~= 'plain' then noSpecials = false end end
  local dis = not (#S.hand == 0 or S.round.discards == 0 or S.busy or S.mode or noSpecials)
  W.button('discard', hx + total + 26, hy + 18, 140, 44, t('btn.discard'), act('discard'), { color = C.mult, enabled = dis, size = 14 })
end

--[[ =====================================================================
   Blind select
   ===================================================================== ]]
local function drawBlinds()
  local x, y, w = STAGE.x + 6, STAGE.y + 6, STAGE.w - 12
  local h = STAGE.h - 144
  gfx.panel(x, y, w, h, 14, gfx.alpha(C.panel, 0.94), C.line, 8)
  gfx.print('num', 28, t('ui.anteN', { n = S.ante }) .. ' ' .. (S.ante > 8 and t('ui.endless') or ''), x + 16, y + 12, C.ink)
  local cw, gap = (w - 32 - 24) / 3, 12
  for i = 0, 2 do
    local b = rules.blindInfo(i)
    local cur, done = i == S.blindIdx, i < S.blindIdx
    local cx = x + 16 + i * (cw + gap)
    local cy = y + 58
    local ch = h - 74
    love.graphics.setColor(1, 1, 1, 1)
    gfx.rrect('fill', cx, cy, cw, ch, 12, gfx.alpha(C.panel2, done and 0.5 or 1))
    if cur then love.graphics.setLineWidth(3); gfx.rrect('line', cx + 1, cy + 1, cw - 2, ch - 2, 12, C.gold) end
    local a = done and 0.5 or 1
    -- chip
    local col = gfx.hex(b.color)
    local ccx, ccy = cx + cw / 2, cy + 46
    love.graphics.setColor(1, 1, 1, 0.1 * a); love.graphics.circle('fill', ccx, ccy, 34)
    love.graphics.setColor(col[1], col[2], col[3], a); love.graphics.circle('fill', ccx, ccy + 0, 30)
    love.graphics.setColor(0, 0, 0, 0.3 * a); love.graphics.arc('fill', ccx, ccy, 30, 0.3, math.pi - 0.3)
    love.graphics.setColor(col[1], col[2], col[3], a); love.graphics.circle('fill', ccx, ccy - 3, 28)
    gfx.print('num', 15, i == 2 and t('ui.boss') or (i == 0 and 'S' or 'B'), cx, ccy - 12, gfx.alpha(C.white, a), 'center', cw)
    gfx.print('num', 20, b.name, cx + 6, cy + 90, gfx.alpha(C.ink, a), 'center', cw - 12)
    gfx.print('ui', 12, t('ui.scoreAtLeast'), cx, cy + 124, gfx.alpha(C.dim, a), 'center', cw)
    gfx.print('num', 28, fmt(b.target), cx, cy + 138, gfx.alpha(C.mult, a), 'center', cw)
    gfx.rich('ui', 13, t('ui.reward') .. ' <u>' .. ('$'):rep(b.reward) .. '</u>', cx + 8, cy + 176, cw - 16, 'center', gfx.alpha(C.dim, a))
    gfx.rich('ui', 12, b.desc, cx + 10, cy + 200, cw - 20, 'center', gfx.alpha(gfx.hex('#ffd7c9'), a))
    local by = cy + ch - 94
    if cur then
      W.button('play' .. i, cx + 10, by, cw - 20, 44, t('btn.play'), act('startBlind'), { color = C.gold, textColor = gfx.hex('#2a1d00'), font = 'num', size = 20 })
      if i < 2 then W.button('skip' .. i, cx + 10, by + 52, cw - 20, 34, t('btn.skip'), act('skipBlind'), { size = 12 }) end
    else
      W.button('x' .. i, cx + 10, by, cw - 20, 36, done and t('btn.defeated') or t('btn.upcoming'), nil, { enabled = false, size = 13 })
    end
  end
end

--[[ =====================================================================
   Shop
   ===================================================================== ]]
-- What a shop / pack item looks like: returns paint fn, face key, edition, name, kind, desc
local function itemView(it)
  if it.kind == 'joker' then
    local d = data.JOKERS[it.id]
    local ed = it.ed and data.EDITIONS[it.ed]
    return { paint = W.paintJoker(it.id), face = 'joker:' .. it.id, ed = ({ foil = 1, holo = 2, poly = 3 })[it.ed or ''] or 0, w = 68, h = 87,
      name = d.name, kind = (ed and (tr(ed.name) .. ' ') or '') .. t('kind.joker', { r = tr(data.RARITY[d.rar].name) }),
      desc = tr(d.desc) .. (ed and ('\n<u>' .. tr(ed.name) .. ':</u> ' .. tr(ed.desc)) or '') }
  elseif it.kind == 'piece' then
    local P = data.PIECES[it.id]
    local ty = it.id
    return { paint = function(w, h) W.drawPiece(ty, 0, 0, w, {}) end, face = 'piece:' .. ty .. ':68', ed = 0, w = 68, h = 68, name = tr(P.name), kind = t('kind.piece'), desc = tr(P.desc) }
  elseif it.kind == 'tile' then
    local T = data.TILES[it.id]
    return { paint = W.paintTile(it.id), face = 'tile:' .. it.id, ed = 0, w = 68, h = 87, name = tr(T.name), kind = t('kind.tile'), desc = tr(T.desc) }
  elseif it.kind == 'voucher' then
    local d = data.VOUCHERS[it.id]
    return { paint = W.paintVoucher(it.id), face = 'voucher:' .. it.id, ed = 0, w = 68, h = 87, name = tr(d.name), kind = t('kind.voucher'), desc = tr(d.desc) }
  end
  local d = data.ITEMS[it.id]
  return { paint = W.paintItem(it.id), face = 'item:' .. it.id, ed = 0, w = 68, h = 87, name = tr(d.name),
    kind = d.kind == 'chalk' and t('kind.chalk') or t('kind.tool'), desc = itemDescText(d) }
end

local CARD_H = 268
local function shopCard(x, y, w, it, price, sold, key, btnLabel, btnFn, btnEnabled)
  local v = itemView(it)
  local h = CARD_H
  gfx.rrect('fill', x, y, w, h, 12, gfx.alpha(C.panel2, sold and 0.4 or 1))
  local a = sold and 0.35 or 1
  local aw, ah = v.w * 0.92, v.h * 0.92
  cards.draw(x + (w - aw) / 2, y + 10, aw, ah, v.paint, { key = key, faceKey = v.face, version = 0, edition = v.ed, alpha = a, noHover = W.blocked or sold, w = v.w, h = v.h })
  local ty = y + 10 + 80 + 8
  gfx.print('num', 15.5, v.name, x + 4, ty, gfx.alpha(C.ink, a), 'center', w - 8)
  local kh = gfx.rich('ui', 10, v.kind, x + 6, ty + 19, w - 12, 'center', gfx.alpha(C.mute, a))
  gfx.rich('ui', 11, v.desc, x + 8, ty + 21 + kh, w - 16, 'center', gfx.alpha(C.dim, a))
  if price then gfx.print('num', 19, '$' .. price, x, y + h - 74, gfx.alpha(C.gold, a), 'center', w) end
  W.button(key .. '-btn', x + 8, y + h - 44, w - 16, 34, btnLabel, btnFn, { color = C.gold, textColor = gfx.hex('#2a1d00'), enabled = btnEnabled, size = 14 })
end

local function drawTilePick(bx, by, size)
  local tid = S.pending
  gfx.rich('ui', 14, t('tile.pick', { name = tr(data.TILES[tid].name) }), STAGE.x + 60, STAGE.y + 4, STAGE.w - 120, 'center', C.dim)
  local empty = {}
  for i = 1, S.N * S.N do empty[i] = false end
  drawBoard(bx, by + 36, size, empty, {
    tiling = true,
    clickable = function() return true end,
    click = function(i) V.insp = nil; engine.actions.applyTile(i) end,
  })
  W.button('canceltile', STAGE.x + STAGE.w / 2 - 100, by + 36 + size + 14, 200, 40, t('btn.cancelRefund'), act('cancelTile'), { size = 14 })
end

-- One shelf of the shop: a titled panel with a coloured rail, so the three kinds of thing on sale
-- (random cards, the ante's voucher, booster packs) are never mixed up.
local function shelf(x, y, w, h, title, hint, accent)
  gfx.panel(x, y, w, h, 14, gfx.alpha(C.panel2, 0.92), C.line, 6)
  gfx.rrect('fill', x + 10, y, w - 20, 4, 2, accent)
  gfx.print('num', 18, title, x + 14, y + 8, accent)
  if hint then gfx.print('ui', 11, hint, x + 14 + gfx.textWidth('num', 18, title) + 12, y + 13, C.mute) end
end

-- A compact sale card: the art on the left, name / kind / description to its right, price and the
-- button along the bottom. Everything in the shop is drawn with this (or its pack twin), so the
-- whole shop fits on screen at once.
local SHOP_ART = 58
local function saleCard(x, y, w, h, v, price, sold, key, btnLabel, btnFn, btnEnabled, accentCol)
  local a = sold and 0.4 or 1
  gfx.rrect('fill', x, y, w, h, 10, gfx.alpha(C.panel3, a))
  local f = SHOP_ART / v.w
  local aw, ah = SHOP_ART, v.h * f
  cards.draw(x + 8, y + 8, aw, ah, v.paint, { key = key, faceKey = v.face, version = 0, edition = v.ed or 0, alpha = a, noHover = W.blocked or sold, w = v.w, h = v.h })
  local tx, tw = x + 8 + aw + 8, w - aw - 24
  local ns = 14.5
  local nw = gfx.textWidth('num', ns, v.name)
  if nw > tw then ns = math.max(10, math.floor(ns * tw / nw * 2) / 2) end   -- long names shrink to fit on one line
  gfx.print('num', ns, v.name, tx, y + 7, gfx.alpha(C.ink, a), 'left', tw)
  local kh = gfx.rich('ui', 9.5, v.kind, tx, y + 26, tw, 'left', gfx.alpha(C.mute, a))
  gfx.rich('ui', 10.5, v.desc, tx, y + 28 + kh, tw, 'left', gfx.alpha(C.dim, a))
  local by = y + h - 36
  gfx.print('num', 18, price and ('$' .. price) or '', x + 10, by + 5, gfx.alpha(C.gold, a))
  W.button(key .. '-btn', x + w - 92, by, 84, 30, btnLabel, btnFn, { color = C.gold, textColor = gfx.hex('#2a1d00'), enabled = btnEnabled, size = 13 })
end

local function drawShop()
  local sh = S.shop
  if not sh then return end
  if S.mode == 'tile' then return drawTilePick(STAGE.x + (STAGE.w - 400) / 2, STAGE.y, 400) end
  local x, y, w, h = STAGE.x + 4, STAGE.y + 2, STAGE.w - 8, STAGE.h - 4
  gfx.panel(x, y, w, h, 14, gfx.alpha(C.panel, 0.95), C.line, 8)
  V.scroll, V.scrollMax = 0, 0        -- the shop always fits: there is nothing to scroll
  gfx.print('num', 24, t('ui.shop'), x + 16, y + 8, C.ink)

  -- Vertical budget: title, two shelves, the button bar. Cards grow into spare height (up to a limit).
  local TOP, BAR, GAP, HEAD = 40, 56, 10, 34
  local cardH = math.max(138, math.min(210, math.floor((h - TOP - BAR - GAP - 3 * 10 - 2 * HEAD) / 2)))
  local shelfH = HEAD + cardH + 10
  local inner = w - 24

  -- Top shelf: the random cards (and the square upgrade), nothing else.
  local sy = y + TOP
  local list = {}
  for i, it in ipairs(sh.items) do list[#list + 1] = { it = it, key = 'i' .. i } end
  if sh.tile then list[#list + 1] = { it = sh.tile, key = 't' } end
  shelf(x + 12, sy, inner, shelfH, t('shop.cards'), t('shop.cardsHint'), C.chips)
  local n = math.max(1, #list)
  local cgap = 8
  local cw = (inner - 20 - (n - 1) * cgap) / n
  for k, e in ipairs(list) do
    local it = e.it
    saleCard(x + 22 + (k - 1) * (cw + cgap), sy + HEAD, cw, cardH, itemView(it), it.cost, it.sold, 'shop' .. e.key,
      it.sold and t('btn.sold') or t('btn.buy'), act('buy', e.key), not it.sold and not S.mode)
  end

  -- Bottom shelves: the voucher on its own, the packs on theirs.
  local by = sy + shelfH + GAP
  local vw = math.floor(inner * 0.3)
  shelf(x + 12, by, vw, shelfH, t('shop.voucher'), t('shop.voucherHint'), C.gold)
  if sh.voucher then
    local vit = { kind = 'voucher', id = sh.voucher, cost = 10, sold = sh.vSold }
    saleCard(x + 22, by + HEAD, vw - 20, cardH, itemView(vit), vit.cost, vit.sold, 'shopv', vit.sold and t('btn.sold') or t('btn.buy'), act('buy', 'v'), not vit.sold and not S.mode)
  end
  local px0 = x + 12 + vw + GAP
  local pwTot = inner - vw - GAP
  shelf(px0, by, pwTot, shelfH, t('shop.packs'), t('shop.packsHint'), C.tool)
  local npk = math.max(1, #(sh.packs or {}))
  local pw = (pwTot - 20 - (npk - 1) * cgap) / npk
  for i, pk in ipairs(sh.packs or {}) do
    local P = data.PACKS[pk.type]
    local pv = { paint = W.paintPack(pk.type), face = 'pack:' .. pk.type, ed = 0, w = 68, h = 87, name = tr(P.name), kind = t('kind.pack'), desc = tr(P.desc) }
    saleCard(px0 + 10 + (i - 1) * (pw + cgap), by + HEAD, pw, cardH, pv, pk.cost, pk.sold, 'pk' .. i .. pk.type,
      pk.sold and t('btn.sold') or t('btn.open'), act('buyPack', i), not pk.sold and not S.mode)
  end

  -- Bar along the bottom.
  local py = y + h - BAR + 6
  local plainN = 0
  for _, p in ipairs(S.bag) do if p.type == 'plain' then plainN = plainN + 1 end end
  W.button('reroll', x + 16, py, 170, 40, t('btn.reroll', { n = sh.reroll }), act('reroll'), { color = C.good, textColor = gfx.hex('#06240f'), font = 'num', size = 17 })
  W.button('trim', x + 196, py, 200, 40, t('btn.trim'), act('trim'), { enabled = not (plainN == 0 or #S.bag <= 5 or sh.trimmed), font = 'num', size = 15, tip = t('trim.title') })
  W.button('next', x + w - 196, py, 180, 40, t('btn.nextRound'), act('nextRound'), { color = C.mult, font = 'num', size = 17 })
end

local function drawStage()
  if S.phase == 'play' then return drawPlay() end
  if S.phase == 'shop' or S.phase == 'cashout' or S.phase == 'won' then return drawShop() end
  return drawBlinds()
end

--[[ =====================================================================
   Overlays
   ===================================================================== ]]
local function overlayKind()
  if V.modal then return V.modal end
  if S.phase == 'title' then return 'title' end
  if S.phase == 'cashout' then return 'cashout' end
  if S.phase == 'over' then return 'over' end
  if S.phase == 'won' then return 'won' end
  if S.phase == 'shop' and S.pack then return 'pack' end
  return nil
end

local function box(f, markup, size)
  local h = gfx.rich('ui', size, markup, 0, 0, f.w - 22, 'left', C.dim, true)
  if not f.dry then
    gfx.rrect('fill', f.x, f.y, f.w, h + 18, 8, C.panel2)
    gfx.rich('ui', size, markup, f.x + 11, f.y + 9, f.w - 22, 'left', C.ink)
  end
  f.y = f.y + h + 18 + 8
end

local function buildOverlay(kind, f)
  local best = state.best()
  if kind == 'title' then
    local tt = 'BALATRO'
    f:gap(4)
    if not f.dry then
      local sz = 36
      local w1, w2, w3 = gfx.textWidth('pix', sz, 'BALATRO'), gfx.textWidth('pix', sz, ' X '), gfx.textWidth('pix', sz, 'TICTACTOE')
      local x0 = f.x + (f.w - (w1 + w2 + w3)) / 2
      local function bob(i) return math.sin(fx.t * 2.6 + i * 0.5) * -3 end
      gfx.print('pix', sz, 'BALATRO', x0, f.y + bob(0), C.ink)
      gfx.print('pix', sz, ' X ', x0 + w1, f.y + bob(1), C.mult)
      gfx.print('pix', sz, 'TICTACTOE', x0 + w1 + w2, f.y + bob(2), C.ink)
    end
    f:gap(gfx.textHeight('pix', 36) + 10)
    local sub = t('title.sub') .. (best.ante > 0 and (' ' .. t('title.best', { a = best.ante, s = fmt(best.score) })) or '')
    f:rich(14, sub, C.dim, 'center'):gap(12)
    for i = 1, 4 do box(f, t('how.' .. i), 14) end
    f:gap(2)
    local items = {}
    if state.hasSavedRun() then
      items[#items + 1] = { id = 'continue', label = t('btn.continue'), fn = act('continueRun'), color = C.gold, textColor = gfx.hex('#2a1d00') }
    end
    items[#items + 1] = { id = 'newrun', label = t('btn.newRun'), fn = act('newRun'), color = #items == 0 and C.gold or C.panel3, textColor = #items == 0 and gfx.hex('#2a1d00') or C.ink }
    f:buttons(items)
  elseif kind == 'cashout' then
    local c = S.cashout
    f:heading(t('cash.title'), C.ink)
    f:rich(14, t('cash.final', { a = fmt(S.round.score), b = fmt(S.round.target) }), C.dim):gap(10)
    local age0 = fx.t - V.cashT0
    for i, r in ipairs(c.rows) do
      local appear = (age0 - (0.25 + (i - 1) * 0.17)) / 0.35
      if f.dry or appear >= 1 then
        f:row(r[1], r[2] > 0 and ('$' .. r[2]) or '-', C.gold, false)
      elseif appear > 0 then
        local e = fx.easeOutBack(appear, 1.5)
        love.graphics.push(); love.graphics.translate(-26 * (1 - e), 0)
        love.graphics.setColor(1, 1, 1, appear)
        f:row(r[1], r[2] > 0 and ('$' .. r[2]) or '-', C.gold, false)
        love.graphics.pop()
      else f.y = f.y + 40 end
    end
    for _, n in ipairs(c.notes) do f:rich(14, n, C.dim) end
    f:gap(4)
    f:buttons({ { id = 'cashout', label = t('cash.btn', { n = c.total }), fn = act('cashOut'), color = C.gold, textColor = gfx.hex('#2a1d00') } })
  elseif kind == 'over' then
    local r = S.round or { score = 0, target = 0 }
    f:heading(t('over.title'), C.mult)
    f:rich(14, t('over.text', { name = rules.blindInfo(S.blindIdx).name, a = S.ante, s = fmt(r.score), t = fmt(r.target) }), C.dim):gap(8)
    local bt = S.stats.bestType ~= '' and (' (' .. tr(data.LINE_TYPES[S.stats.bestType].name) .. ')') or ''
    f:row(t('over.best'), fmt(S.stats.bestLine) .. bt, C.gold)
    f:row(t('over.lines'), tostring(S.stats.lines), C.gold)
    local names = {}
    for _, j in ipairs(S.jokers) do names[#names + 1] = data.JOKERS[j.id].name end
    f:row(t('over.jokers'), #names > 0 and table.concat(names, ', ') or t('none'), C.ink)
    f:gap(4)
    f:buttons({ { id = 'newrun', label = t('btn.newRun'), fn = act('newRun'), color = C.gold, textColor = gfx.hex('#2a1d00') } })
  elseif kind == 'won' then
    f:heading(t('won.title'), C.gold)
    f:rich(14, t('won.text', { s = fmt(S.stats.bestLine) }), C.dim):gap(8)
    f:buttons({ { id = 'endless', label = t('btn.endless'), fn = act('endless'), color = C.gold, textColor = gfx.hex('#2a1d00') },
      { id = 'newrun', label = t('btn.newRun'), fn = act('newRun') } })
  elseif kind == 'pack' then
    local pk = S.pack
    local P = data.PACKS[pk.type]
    f:heading(tr(P.name), C.ink)
    f:rich(14, pk.left == 1 and t('pack.left1') or t('pack.left', { n = pk.left }), C.dim):gap(8)
    local n = #pk.options
    local cw, gap = 136, 8
    local rowW = n * cw + (n - 1) * gap
    local x0 = f.x + (f.w - rowW) / 2
    for i, o in ipairs(pk.options) do
      if not f.dry then
        local age = fx.t - V.packT0 - (i - 1) * 0.14
        local e = fx.clamp01(age / 0.5)
        local k = fx.easeOutBack(e, 1.4)
        love.graphics.push()
        local cx = x0 + (i - 1) * (cw + gap) + cw / 2
        love.graphics.translate(cx, f.y + 140)
        love.graphics.scale(math.max(0.01, k), math.max(0.01, k))
        love.graphics.translate(-cx, -(f.y + 140))
        local it = o.kind == 'item' and { kind = 'item', id = o.id } or o
        shopCard(x0 + (i - 1) * (cw + gap), f.y, cw, it, nil, o.taken, 'pack' .. i, o.taken and t('btn.taken') or t('btn.take'), act('takePack', i), not o.taken)
        love.graphics.pop()
      end
    end
    f:gap(CARD_H + 10)
    f:buttons({ { id = 'skippack', label = t('btn.skipPack'), fn = act('skipPack') } })
  elseif kind == 'info' then
    f:heading(t('info.title'), C.ink)
    -- table
    local cols = { 0, 0.34, 0.5, 0.78 }
    local heads = { t('info.type'), t('info.level'), t('info.base'), t('info.scored') }
    if not f.dry then
      for i, hd in ipairs(heads) do gfx.print('ui', 12, hd, f.x + f.w * cols[i], f.y, C.dim) end
    end
    f:gap(20)
    for _, k in ipairs(data.LINE_ORDER) do
      local v = rules.lineValues(k)
      if not f.dry then
        gfx.print('ui', 15, tr(data.LINE_TYPES[k].name), f.x + f.w * cols[1], f.y, C.ink)
        gfx.print('ui', 15, tostring(S.levels[k]), f.x + f.w * cols[2], f.y, C.ink)
        gfx.rich('ui', 15, '<i>' .. v.chips .. '</i> &times; <em>' .. fmtM(v.mult) .. '</em>', f.x + f.w * cols[3], f.y, 200, 'left', C.ink)
        gfx.print('ui', 15, tostring(S.played[k]), f.x + f.w * cols[4], f.y, C.ink)
        love.graphics.setColor(1, 1, 1, 0.08); love.graphics.rectangle('fill', f.x, f.y + 24, f.w, 1)
      end
      f:gap(28)
    end
    f:gap(6)
    local vs = {}
    for _, v in ipairs(S.vouchers) do vs[#vs + 1] = tr(data.VOUCHERS[v].name) end
    local boss = S.boss and data.BOSSES[S.boss.id]
    f:rich(14, t('info.p1', { n = S.N }), C.dim):gap(6)
    if boss then f:rich(14, t('info.boss', { name = tr(boss.name), desc = tr(boss.desc) }), C.dim):gap(6) end
    f:rich(14, t('info.vouchers', { list = #vs > 0 and table.concat(vs, ', ') or t('info.noneYet') }), C.dim):gap(10)
    f:buttons({
      { id = 'm-speed', label = t('ui.speed', { n = SET.speed }), fn = act('toggleSpeed'), font = 'ui', size = 14, h = 36 },
      { id = 'm-sound', label = SET.sound and t('ui.soundOn') or t('ui.soundOff'), fn = act('toggleSound'), font = 'ui', size = 14, h = 36 },
      { id = 'm-crt', label = SET.crt and t('ui.crtOn') or t('ui.crtOff'), fn = act('toggleCrt'), font = 'ui', size = 14, h = 36 },
      { id = 'm-size', label = t('ui.uiSize', { n = t('ui.size' .. (SET.uiSize or 2)) }), fn = local_(function() if V.hooks.cycleUiSize then V.hooks.cycleUiSize() end end), font = 'ui', size = 14, h = 36 },
    })
    f:buttons({
      { id = 'm-close', label = t('btn.close'), fn = function() V.showModal(nil) end },
      { id = 'm-abandon', label = V.abandonArmed and t('btn.abandonSure') or t('btn.abandon'), color = C.mult,
        fn = function()
          if not V.abandonArmed then V.abandonArmed = true; return end
          V.modal = nil; V.abandonArmed = false; engine.actions.abandon()
        end },
    })
  elseif kind == 'bag' then
    local counts, order = {}, {}
    for _, p in ipairs(S.bag) do
      if not counts[p.type] then counts[p.type] = 0; order[#order + 1] = p.type end
      counts[p.type] = counts[p.type] + 1
    end
    f:heading(t('bag.title', { n = #S.bag }), C.ink)
    f:rich(14, t('bag.text', { n = rules.handMax() }), C.dim):gap(10)
    local per = math.floor((f.w + 8) / 56)
    local rows = math.ceil(#S.bag / per)
    if not f.dry then
      for i, p in ipairs(S.bag) do
        local r, c = math.floor((i - 1) / per), (i - 1) % per
        W.drawPiece(p.type, f.x + c * 56, f.y + r * 56, 48, {})
      end
    end
    f:gap(rows * 56 + 6)
    for _, k in ipairs(order) do
      local P = data.PIECES[k]
      f:row(tr(P.name) .. ' ×' .. counts[k], '', C.dim)
    end
    f:buttons({ { id = 'm-close', label = t('btn.close'), fn = function() V.showModal(nil) end } })
  end
end

local function drawOverlay(kind)
  W.blocked = false
  love.graphics.setColor(0.02, 0.055, 0.05, 0.74)
  love.graphics.rectangle('fill', -gfx.ox / gfx.scale, -gfx.oy / gfx.scale, gfx.W + 2 * gfx.ox / gfx.scale, gfx.H + 2 * gfx.oy / gfx.scale)
  local wide = (kind == 'title' or kind == 'pack') and 700 or 580
  if kind == 'pack' then wide = math.max(wide, (#S.pack.options * 144 + 60)) end
  local pad = 22
  local dry = W.flow(0, 0, wide - pad * 2, true)
  buildOverlay(kind, dry)
  local hgt = math.min(gfx.H - 24, dry:height() + pad * 2)
  local x, y = (gfx.W - wide) / 2, (gfx.H - hgt) / 2
  local age = math.min(1, (fx.t - (V.overlayT0 or 0)) / 0.25)
  local sc = 0.85 + 0.15 * fx.easeOutBack(age, 1.6)
  love.graphics.push()
  love.graphics.translate(gfx.W / 2, gfx.H / 2)
  love.graphics.scale(sc, sc)
  love.graphics.translate(-gfx.W / 2, -gfx.H / 2)
  gfx.panel(x, y, wide, hgt, 16, C.panel, C.line, 12)
  love.graphics.setLineWidth(3)
  gfx.rrect('line', x + 1.5, y + 1.5, wide - 3, hgt - 3, 16, C.line)
  W.region('modalbody', x, y, wide, hgt, nil)
  local f = W.flow(x + pad, y + pad, wide - pad * 2, false)
  buildOverlay(kind, f)
  love.graphics.pop()
  if kind == 'info' or kind == 'bag' then
    -- clicking outside closes
    W.region('modalbg', 0, 0, gfx.W, gfx.H, function() V.showModal(nil) end)
  end
end

--[[ =====================================================================
   Inspector popover and floating bits
   ===================================================================== ]]
local function drawInspector()
  local I = V.insp
  if not I then return end
  local w = 290
  local d, title, tag, tagCol, desc, buttons, why
  if I.kind == 'joker' then
    local j
    for _, x in ipairs(S.jokers) do if x.uid == I.uid then j = x end end
    if not j then V.insp = nil; return end
    local jd = data.JOKERS[j.id]
    local ed = j.ed and data.EDITIONS[j.ed]
    title, tag, tagCol = jd.name, t('kind.joker', { r = tr(data.RARITY[jd.rar].name) }), W.rarityColor(jd.rar)
    desc = tr(data.jokerDesc(j.id, j)) .. (ed and ('\n<u>' .. tr(ed.name) .. ':</u> ' .. tr(ed.desc)) or '')
    buttons = {
      { id = 'i-sell', label = t('btn.sell', { n = engine.jokerSellValue(j) }), fn = act('sellJoker', j.uid), color = C.mult, enabled = not S.busy },
      { id = 'i-close', label = t('btn.close'), fn = function() V.insp = nil end },
    }
  else
    local c
    for _, x in ipairs(S.items) do if x.uid == I.uid then c = x end end
    if not c then V.insp = nil; return end
    local d_ = data.ITEMS[c.id]
    title, tag, tagCol = tr(d_.name), d_.kind == 'chalk' and t('tag.chalk') or t('tag.tool'), d_.kind == 'chalk' and C.chalk or C.tool
    desc = itemDescText(d_)
    why = engine.actions.itemBlocked(c.uid)
    buttons = {
      { id = 'i-use', label = t('btn.use'), fn = act('useItem', c.uid), color = C.gold, textColor = gfx.hex('#2a1d00'), enabled = why == '' },
      { id = 'i-sell', label = t('btn.sell', { n = 1 }), fn = act('sellItem', c.uid), color = C.mult, enabled = not S.busy },
      { id = 'i-close', label = t('btn.close'), fn = function() V.insp = nil end },
    }
  end
  local dh = gfx.rich('ui', 14, desc, 0, 0, w - 24, 'left', C.dim, true)
  local h = 12 + 22 + 24 + dh + 12 + ((why and why ~= '' and why ~= ' ') and 22 or 0) + 38 + 12
  local x = math.max(12, math.min(gfx.W - w - 12, I.ax + I.aw / 2 - w / 2))
  local y = I.ay + I.ah + 10
  if y + h > gfx.H - 12 then y = math.max(12, I.ay - h - 10) end
  gfx.panel(x, y, w, h, 12, C.panel, C.line, 8)
  W.region('insp', x, y, w, h, nil)
  gfx.print('num', 18, title, x + 12, y + 10, C.ink)
  local tw = gfx.textWidth('ui', 11, tag) + 12
  gfx.rrect('fill', x + 12, y + 34, tw, 18, 5, tagCol)
  gfx.print('ui', 11, tag, x + 12, y + 36, C.white, 'center', tw)
  local cy = y + 58
  gfx.rich('ui', 14, desc, x + 12, cy, w - 24, 'left', C.dim)
  cy = cy + dh + 4
  if why and why ~= '' and why ~= ' ' then gfx.print('ui', 12, why, x + 12, cy, C.dim); cy = cy + 22 end
  local bwid = (w - 24 - 8 * (#buttons - 1)) / #buttons
  for i, b in ipairs(buttons) do
    W.button(b.id, x + 12 + (i - 1) * (bwid + 8), cy + 6, bwid, 32, b.label, b.fn, { color = b.color, textColor = b.textColor, enabled = b.enabled, size = 13 })
  end
end

local POP_COL = { chips = C.chips, mult = C.mult, xmult = C.multDk, money = C.gold, dim = gfx.hex('#555555'), info = C.panel3 }
local function drawPops()
  for _, p in ipairs(fx.pops) do
    local age = (fx.t - p.t0) / p.dur
    local sc, dy, op, rot
    if age < 0.16 then local k = age / 0.16; sc = 0.5 + 0.9 * k; dy = -0.3 - 0.4 * k; op = k; rot = p.rot * k
    elseif age < 0.34 then local k = (age - 0.16) / 0.18; sc = 1.4 - 0.32 * k; dy = -0.7 - 0.08 * k; op = 1; rot = p.rot * (1 - 1.4 * k)
    else local k = (age - 0.34) / 0.66; sc = 1.08 - 0.08 * k; dy = -0.78 - 0.92 * k; op = 1 - k * k; rot = -p.rot * 0.4 * (1 - k) end
    local f = 19
    local tw = gfx.textWidth('num', f, p.text) + 16
    local th = gfx.textHeight('num', f) + 4
    love.graphics.push()
    love.graphics.translate(p.x, p.y + dy * 38)
    love.graphics.rotate(rot)
    love.graphics.scale(sc, sc)
    local col = POP_COL[p.cls] or C.panel3
    gfx.rrect('fill', -tw / 2, -th / 2 + 3, tw, th, 6, { 0, 0, 0, 0.35 * op })
    gfx.rrect('fill', -tw / 2, -th / 2, tw, th, 6, gfx.alpha(col, op))
    if p.cls == 'xmult' then love.graphics.setLineWidth(2); gfx.rrect('line', -tw / 2, -th / 2, tw, th, 6, gfx.alpha(C.mult, op)) end
    gfx.print('num', f, p.text, -tw / 2, -th / 2 + 1, gfx.alpha(p.cls == 'money' and gfx.hex('#2a1d00') or C.white, op), 'center', tw)
    love.graphics.pop()
  end
end

local function drawToast()
  local tt = fx.toasts[#fx.toasts]
  if not tt then return end
  local age = fx.t - tt.t0
  local op = math.min(1, age / 0.15, (2.0 - age) / 0.3)
  if op <= 0 then return end
  local tw = math.min(gfx.W - 80, gfx.textWidth('ui', 15, tt.text) + 36)
  local x, y = (gfx.W - tw) / 2, gfx.H - 46
  gfx.rrect('fill', x, y, tw, 36, 10, gfx.alpha(C.panel, op))
  love.graphics.setLineWidth(2)
  gfx.rrect('line', x + 1, y + 1, tw - 2, 34, 10, gfx.alpha(C.line, op))
  gfx.print('ui', 15, tt.text, x, y + 8, gfx.alpha(C.ink, op), 'center', tw)
end

--[[ =====================================================================
   Frame
   ===================================================================== ]]
function V.draw()
  if S.phase ~= V.lastPhase then
    if S.phase == 'cashout' then V.cashT0 = fx.t end
    if V.lastPhase == 'play' or S.phase == 'shop' then V.scroll = 0 end
    V.lastPhase = S.phase
    V.overlayT0 = fx.t
  end
  local pk = S.pack
  if pk ~= V.lastPack then V.lastPack = pk; if pk and pk ~= V.lastPackSeen then V.packT0 = fx.t end; V.lastPackSeen = pk end
  local kind = overlayKind()
  if kind ~= V.lastKind then V.lastKind = kind; V.overlayT0 = fx.t end
  cards.blocked = kind ~= nil
  W.blocked = kind ~= nil
  fx.layout.cells = {}
  relayout()
  local sx, sy, sr = fx.shakeOffset()
  love.graphics.push()
  love.graphics.translate(gfx.W / 2, gfx.H / 2)
  love.graphics.rotate(sr)
  love.graphics.translate(-gfx.W / 2 + sx, -gfx.H / 2 + sy)
  drawSide()
  drawRack()
  drawStage()
  love.graphics.pop()
  if kind then drawOverlay(kind) end
  W.blocked = false
  drawInspector()
  drawPops()
  drawToast()
  if not kind or kind == 'info' then
    local r = W.hoverRegion
    if r and r.tip and not V.insp then W.tip = r.tip end
  end
  W.drawTip()
end

function V.onClickOutside()
  if V.insp and W.hoverId ~= 'insp' then V.insp = nil end
end

return V
