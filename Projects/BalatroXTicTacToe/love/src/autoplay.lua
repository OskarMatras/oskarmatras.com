-- Developer tool: `love . --autoplay [--shots dir] [--seed n]` plays ante 1 with a
-- simple bot through the real UI (real engine, real drawing), takes screenshots
-- at key moments and prints frame-time statistics. `--bench` is the same
-- without screenshots. Not used in normal play.
local state = require('src.state')
local engine = require('src.engine')
local fx = require('src.fx')
local rules = require('src.rules')
local data = require('src.data')
local geometry = require('src.geometry')
local rng = require('src.rng')

local S = state.S
local M = {}
local act = engine.actions

local cool, shotsDir, taken, attempts, frames, startT = 0, nil, {}, 0, {}, 0
local updateAcc, quitting, pendingShot = 0, false, nil
local flags

local function log(...) print('[autoplay]', ...) end
local W = require('src.widgets')
local clicks, fallbacks = 0, 0
local updates = {}
local missing = {}
local clickQ = nil   -- { stage, x, y, id }

-- Click a UI region by id the way a player would: move the pointer, press, release.
local function go(id, fallback)
  local r
  for _, reg in ipairs(W.prev) do if reg.id == id and reg.fn then r = reg end end
  if r then
    clickQ = { stage = 1, x = r.x + r.w / 2, y = r.y + r.h / 2, id = id }
    W.mouseOverride = { x = clickQ.x, y = clickQ.y }
    clicks = clicks + 1
    return true
  end
  missing[id] = (missing[id] or 0) + 1
  if missing[id] < 30 then cool = 0.04; return false end   -- the screen may not have been drawn yet
  missing[id] = nil
  fallbacks = fallbacks + 1
  log('no clickable region', id, '- using the action directly (phase', S.phase, 'busy', tostring(S.busy), 'mode', tostring(S.mode), 'hand', #S.hand, ')')
  if fallback then fallback() end
  return false
end
local function stepClick()
  if not clickQ then return false end
  local q = clickQ
  local gx, gy = (q.x * require('src.gfx').scale) + require('src.gfx').ox, (q.y * require('src.gfx').scale) + require('src.gfx').oy
  if q.stage == 1 then q.stage = 2 -- let a frame pass so hover is computed from the moved pointer
  elseif q.stage == 2 then love.mousepressed(gx, gy, 1); q.stage = 3
  else love.mousereleased(gx, gy, 1); clickQ = nil; W.mouseOverride = nil end
  return true
end


local function shot(name, delay)
  if taken[name] or not shotsDir then return end
  taken[name] = true
  love.graphics.captureScreenshot(function(img)
    local fd = img:encode('png')
    local f = io.open(shotsDir .. '/' .. name .. '.png', 'wb')
    if f then f:write(fd:getString()); f:close() end
  end)
  log('shot', name)
end

function M.start(fl)
  flags = fl
  shotsDir = fl.shots
  if fl.autoplay and not shotsDir then shotsDir = nil end
  startT = love.timer.getTime()
  log('started; seed', fl.seed or 'random')
end

local function stats(list)
  table.sort(list)
  local n = #list
  if n == 0 then return 0, 0, 0 end
  local sum = 0
  for _, v in ipairs(list) do sum = sum + v end
  return sum / n * 1000, list[math.max(1, math.floor(n * 0.95))] * 1000, list[n] * 1000
end

local function finish(msg)
  if quitting then return end
  quitting = true
  log(msg)
  local d = {}
  for i, v in ipairs(frames) do d[i] = v end
  local mean, p95, max = stats(d)
  local wall = love.timer.getTime() - startT
  local um, up95, umax = stats(updates)
  log(('update-cpu-ms mean=%.3f p95=%.3f max=%.3f'):format(um, up95, umax))
  log(('frames=%d wall=%.1fs avg-fps=%.0f  draw-cpu-ms mean=%.2f p95=%.2f max=%.2f  (vsync=%s)'):format(#frames, wall, #frames / wall, mean, p95, max, tostring(select(3, love.window.getMode()).vsync)))
  love.event.quit(0)
end

local function choosePlay()
  local N = S.N
  -- pick a special piece first when we hold one
  local sp
  for k, p in ipairs(S.hand) do if p.type ~= 'plain' then sp = k; break end end
  if sp and sp ~= S.selIdx then go('hand' .. sp, function() act.selectPiece(sp) end); return end
  local G = geometry.geo()
  local win, block, empty = nil, nil, {}
  for i = 1, N * N do if not S.board[i] then empty[#empty + 1] = i end end
  for li, l in ipairs(G.lines) do
    local xs, os_, em = 0, 0, nil
    for _, i in ipairs(l.cells) do
      local c = S.board[i]
      if c and c.t == 'X' then xs = xs + 1 elseif c and c.t == 'O' then os_ = os_ + 1 elseif not c then em = i end
    end
    local scored = false
    for _, s in ipairs(S.g.scored) do if s == li then scored = true end end
    if xs == 2 and em and not scored then win = em end
    if os_ == 2 and em then block = block or em end
  end
  local pick = win or block
  if not pick then
    -- build toward a line: prefer cells on lines that already hold an X and no O
    local best, bestScore = nil, -1
    for _, i in ipairs(empty) do
      local sc = 0
      for _, l in ipairs(G.lines) do
        local has = false
        for _, c in ipairs(l.cells) do if c == i then has = true end end
        if has then
          local xs, os_ = 0, 0
          for _, c in ipairs(l.cells) do local b = S.board[c]; if b and b.t == 'X' then xs = xs + 1 elseif b and b.t == 'O' then os_ = os_ + 1 end end
          if os_ == 0 then sc = sc + 1 + xs * 3 end
        end
      end
      sc = sc + rng.random() * 0.5
      if sc > bestScore then best, bestScore = i, sc end
    end
    pick = best
  end
  if pick then go('cell' .. pick, function() act.cell(pick) end) end
end

local function chooseShop()
  if S.pack then
    for i, o in ipairs(S.pack.options) do if not o.taken then go('pack' .. i .. '-btn', function() act.takePack(i) end); return end end
    go('skippack', function() act.skipPack() end); return
  end
  if S.mode == 'tile' then local c = math.ceil(S.N * S.N / 2); go('cell' .. c, function() act.applyTile(c) end); return end
  local sh = S.shop
  -- best-value first: jokers, then the tile, a pack, then pieces
  for i, it in ipairs(sh.items) do
    if not it.sold and it.kind == 'joker' and S.money >= it.cost and #S.jokers < S.jokerSlots then go('shopi' .. i .. '-btn', function() act.buy('i' .. i) end); return end
  end
  if not sh.tile.sold and S.money >= sh.tile.cost + 3 then go('shopt-btn', function() act.buy('t') end); return end
  for i, pk in ipairs(sh.packs) do
    if not pk.sold and S.money >= pk.cost + 2 then go('pack' .. i, function() act.buyPack(i) end); return end
  end
  for i, it in ipairs(sh.items) do
    if not it.sold and S.money >= it.cost and it.kind ~= 'joker' and (it.kind ~= 'item' or #S.items < S.itemSlots) then go('shopi' .. i .. '-btn', function() act.buy('i' .. i) end); return end
  end
  go('next', function() act.nextRound() end)
end

-- A scripted look at the screens a player can open, for screenshots.
local tour, tourStep = nil, 0
local function startTour()
  local V = require('src.view')
  local strings = require('src.strings')
  tour = {
    function() V.showModal('info') end, 'info',
    function() V.showModal('bag') end, 'bag',
    function() V.showModal(nil); strings.setLang('da') end, 'da',
    function() strings.setLang('en') end, nil,
    -- a stuffed-run showcase: 4x4 board, edition Jokers, items, square upgrades
    function()
      rules.freshRun()
      S.N = 4; S.money = 120; S.ante = 3; S.phase = 'blind'; S.blindIdx = 0
      S.board = {}; for i = 1, 16 do S.board[i] = false end
      for _, id in ipairs({ 'snowball', 'combo', 'momentum', 'corner', 'midas', 'hermit', 'fork' }) do
        S.jokers[#S.jokers + 1] = { uid = state.nid(), id = id, ed = ({ snowball = 'foil', combo = 'holo', momentum = 'poly' })[id], data = { m = 6, n = 4 } }
      end
      S.items = { { uid = state.nid(), id = 'eraser' }, { uid = state.nid(), id = 'chalk_diag' } }
      for _, ty in ipairs({ 'red', 'glass', 'steel', 'twin', 'bomb', 'lucky', 'mirror' }) do S.bag[#S.bag + 1] = rules.newPiece(ty) end
      S.squares = { ['0,0'] = { hot = 2 }, ['1,1'] = { rich = 1, echo = 1 }, ['3,3'] = { gild = 1 } }
      S.jokerSlots = 8
    end, 'showcase-blind',
    function() act.startBlind() end, nil,
    function() S.round.target = 1e9 end, nil,
    function() act.cell(6) end, nil,
    function() act.cell(11) end, 'showcase-play',
    function() act.cell(16) end, nil,
    function() act.cell(1) end, 'showcase-play2',
    function() S.mode = nil; engine.finishForShowcase() end, 'showcase-shop',
    function() S.money = 60; act.buyPack(1) end, nil,
    function() end, nil,
    function() end, nil,
    function() end, 'showcase-pack',
    function() act.skipPack(); S.money = 60; act.buyPack(2) end, nil,
    function() end, nil,
    function() end, nil,
    function() end, 'showcase-pack2',
    function() act.skipPack() end, nil,
    function() S.mode = 'tile'; S.pending = 'hot' end, 'showcase-tile',
    function() S.mode = nil; V.showModal(nil); S.phase = 'over'; S.round = S.round or { score = 0, target = 500 } end, 'showcase-over',
  }
  tourStep = 0
end
local function runTour()
  tourStep = tourStep + 1
  local fn, name = tour[tourStep * 2 - 1], tour[tourStep * 2]
  if not fn then finish('ANTE 1 COMPLETE (tour done)'); return end
  fn()
  cool = 0.7
  if name then pendingShot = name end
end

local delayed = {}
local function snapFirst(name, wait)
  if taken[name] then return false end
  taken[name] = true
  delayed[#delayed + 1] = { name = name, t = (wait or 0.6) * 0.7 }
  cool = wait or 0.6
  return true
end

function M.update(dt)
  updateAcc = updateAcc + dt
  if quitting then return end
  if stepClick() then return end
  if pendingShot then local n = pendingShot; pendingShot = nil; shot(n) end
  for i = #delayed, 1, -1 do
    local d = delayed[i]
    d.t = d.t - dt
    if d.t <= 0 then table.remove(delayed, i); taken[d.name] = nil; shot(d.name); taken[d.name] = true end
  end
  if S.phase == 'play' and fx.calc.label and fx.calc.chips > 5 then shot('scoring') end
  if S.phase == 'play' and fx.banner then shot('banner') end
  cool = cool - dt
  if cool > 0 or S.busy or not engine.idle() then return end
  cool = 0.12
  if tour then return runTour() end
  local p = S.phase
  if p == 'title' then if snapFirst('title', 0.8) then return end; go('newrun', function() act.newRun() end); return end
  if p == 'blind' then
    if snapFirst('blind') then return end
    if S.ante >= 2 then
      log(('input: %d region clicks, %d direct-action fallbacks'):format(clicks, fallbacks))
      log('ANTE 1 COMPLETE: reached ante ' .. S.ante .. ' with $' .. S.money .. ', ' .. #S.jokers .. ' Jokers')
      if shotsDir then startTour() else finish('ANTE 1 COMPLETE') end
      return
    end
    go('play' .. S.blindIdx, function() act.startBlind() end); return
  end
  if p == 'play' then if snapFirst('play', 1.0) then return end; choosePlay(); return end
  if p == 'cashout' then if snapFirst('cashout', 1.6) then return end; go('cashout', function() act.cashOut() end); return end
  if p == 'shop' then
    if S.pack then if snapFirst('pack', 1.0) then return end end
    if S.mode == 'tile' then if snapFirst('tile', 0.6) then return end end
    if S.ante >= 2 and not S.pack and not S.mode then if snapFirst('shop') then return end end
    chooseShop(); return
  end
  if p == 'over' then
    if snapFirst('over', 0.6) then return end
    attempts = attempts + 1
    log('run ended in game over at ante', S.ante, 'blind', S.blindIdx, '- attempt', attempts)
    if attempts >= 8 then finish('gave up after ' .. attempts .. ' attempts') return end
    go('newrun', function() act.newRun() end); return
  end
end

function M.afterUpdate(secs) if not quitting then updates[#updates + 1] = secs end end
function M.afterDraw(drawSecs)
  if not quitting then frames[#frames + 1] = drawSecs end
end

return M
