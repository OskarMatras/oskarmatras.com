-- Game flow: rounds, placing pieces, the rival, scoring, the shop.
--
-- This is the logic of the web version's engine.js with all drawing taken
-- out. It talks to the interface only through the `ui` hook table (every hook
-- is optional and defaults to a no-op) and to the sound system through `sfx`.
--
-- Animation timing: the JS awaits sleeps. Here, `sleep(ms)` yields the current
-- coroutine when M.async is true (the game runs actions as coroutines driven by
-- love.update). With M.async false (tests, headless tools) sleep does nothing
-- and every action runs to completion before it returns.
--
-- Every player action is an entry in `actions`. Cell indices are 1-based.
local state = require('src.state')
local geometry = require('src.geometry')
local data = require('src.data')
local rules = require('src.rules')
local strings = require('src.strings')
local audio = require('src.audio')
local rng = require('src.rng')
local util = require('src.util')

local S, SET, nid = state.S, state.SET, state.nid
local saveRun, clearRun, saveBest, loadRun, saveSettings = state.saveRun, state.clearRun, state.saveBest, state.loadRun, state.saveSettings
local geo, rc, squareOf, neighbours, isCenter, mirrorOf = geometry.geo, geometry.rc, geometry.squareOf, geometry.neighbours, geometry.isCenter, geometry.mirrorOf
local PIECES, SPECIALS, TILES, JOKERS, ITEMS, VOUCHERS, LINE_TYPES, EDITIONS, PACKS, hasJ = data.PIECES, data.SPECIALS, data.TILES, data.JOKERS, data.ITEMS, data.VOUCHERS, data.LINE_TYPES, data.EDITIONS, data.PACKS, data.hasJ
local rand, shuffle, newPiece, freshRun, nextBoss, blindInfo, lineValues, handMax, isBoss = rules.rand, rules.shuffle, rules.newPiece, rules.freshRun, rules.nextBoss, rules.blindInfo, rules.lineValues, rules.handMax, rules.isBoss
local emptyCells, oWon, newXLines, viableLines, threats = rules.emptyCells, rules.oWon, rules.newXLines, rules.viableLines, rules.threats
local t, tr, fmt, fmtM = strings.t, strings.tr, strings.fmt, strings.fmtM
local sfx, resetStep = audio.sfx, audio.resetStep
local nz, includes = util.nz, util.includes

local M = {}

-- Interface hooks: the app fills these in; missing ones do nothing.
local ui = setmetatable({}, { __index = function() return function() end end })
M.ui = ui

-- Coroutine plumbing ---------------------------------------------------------
M.async = false
local tasks = {}

local function sleep(ms)
  if M.async and coroutine.running() then coroutine.yield(ms / SET.speed / 1000) end
end

local function resume(task, ...)
  local ok, wait = coroutine.resume(task.co, ...)
  if not ok then error(debug.traceback(task.co, tostring(wait)), 0) end
  if coroutine.status(task.co) == 'dead' then return false end
  task.wake = wait or 0
  return true
end
local function spawn(fn, ...)
  if not M.async then return fn(...) end
  local task = { co = coroutine.create(fn) }
  if resume(task, ...) then tasks[#tasks + 1] = task end
end
function M.update(dt)
  for i = #tasks, 1, -1 do
    local task = tasks[i]
    task.wake = task.wake - dt
    if task.wake <= 0 and not resume(task) then table.remove(tasks, i) end
  end
end
function M.idle() return #tasks == 0 end

local function jokerOf(id)
  for _, j in ipairs(S.jokers) do if j.id == id then return j end end
end

-- Re-render and save whenever the run is at rest.
local function settle() ui.render(); saveRun() end

--[[ =================================================================
   Rounds and games
   ================================================================= ]]
local newGame, endGame, winBlind, gameOver, makeShop

local function startBlind()
  if S.phase ~= 'blind' then return end
  sfx.click()
  local b = blindInfo(S.blindIdx)
  local games, discards = S.maxGames, S.maxDiscards
  if S.blindIdx == 2 and S.boss.id == 'needle' then games = 2 end
  if S.blindIdx == 2 and S.boss.id == 'drought' then discards = 0 end
  S.round = { score = 0, target = b.target, games = games, discards = discards, gameNo = 0, reward = b.reward, name = b.name }
  S.phase = 'play'; S.mode = nil
  spawn(newGame)
end

local function refill()
  while #S.hand < handMax() do
    -- An empty bag never blocks play: you get a temporary Plain X.
    local p = table.remove(S.g.pile) or { uid = -1, type = 'plain', temp = true }
    p.dealt = true; S.hand[#S.hand + 1] = p
  end
  if S.selIdx > #S.hand then S.selIdx = 1 end
end


function newGame()
  local N = S.N
  S.board = {}
  for i = 1, N * N do S.board[i] = false end
  S.round.gameNo = S.round.gameNo + 1
  local pile = {}
  for i, p in ipairs(S.bag) do
    local copy = {}
    for k, v in pairs(p) do copy[k] = v end
    pile[i] = copy
  end
  S.g = { scored = {}, placements = 0, aiMoves = 0, lines = 0, haste = false, pile = shuffle(pile) }
  S.hand = {}; S.selIdx = 1
  if isBoss('wall') then
    local cs = {}
    for i = 1, N * N do if isCenter(i) then cs[#cs + 1] = i end end
    S.board[rand(cs)] = { t = 'S' }
  end
  if isBoss('crowd') then
    local all = {}
    for i = 1, N * N do all[i] = i end
    shuffle(all)
    for k = 1, 2 do S.board[all[k]] = { t = 'S' } end
  end
  refill()
  if S.ante == 1 and S.blindIdx == 0 and S.round.gameNo == 1 then ui.toast(t('toast.first')) end
  local special = util.find_index(S.hand, function(p) return p.type ~= 'plain' end)
  S.selIdx = special or 1
  if isBoss('echo') then
    S.busy = true; ui.render()
    sleep(500); M.aiMove(); sfx.o()
    S.busy = false
  end
  settle()
end

local function selectPiece(k)
  if S.busy or S.phase ~= 'play' then return end
  S.selIdx = k; sfx.click(); ui.render()
end

local function discard()
  if S.busy or #S.hand == 0 or S.round.discards == 0 then return end
  table.remove(S.hand, S.selIdx); S.round.discards = S.round.discards - 1
  refill(); S.selIdx = #S.hand; sfx.click(); settle()
end

local placeX

local function onCell(i)
  if S.busy or S.phase ~= 'play' or not (i >= 1 and i <= #S.board) then return end
  local c = S.board[i]
  if S.mode == 'erase' then
    if c and c.t == 'O' then
      S.board[i] = false
      S.items = util.filter(S.items, function(x) return x.uid ~= S.pending end)
      S.mode = nil; S.pending = nil; sfx.line(); ui.toast(t('toast.erased')); settle()
    else ui.toast(t('toast.tapO')) end
    return
  end
  if c or #S.hand == 0 then return end
  spawn(placeX, i)
end

-- One full turn: your X, bombs, scoring, the rival's answer, end checks.
local scoreLine
function placeX(i)
  S.busy = true
  local threatsBefore = #threats()
  local p = table.remove(S.hand, S.selIdx)
  S.board[i] = { t = 'X', p = p, fresh = true }
  S.g.placements = S.g.placements + 1
  sfx.place(); ui.render()

  if p.type == 'bomb' then
    local targets = util.filter(neighbours(i), function(k) return S.board[k] and S.board[k].t == 'O' end)
    if #targets > 0 then
      local k = rand(targets)
      sleep(200); ui.pop(ui.cellEl(k), t('pop.boom'), 'xmult'); sfx.boom()
      S.board[k] = false
      local demo = jokerOf('demolition')
      if demo then demo.data.m = (demo.data.m or 0) + 3; ui.jig(ui.jokerEl(demo.uid)) end
      ui.render()
    end
  end
  if p.type == 'mirror' then
    local m = mirrorOf(i)
    if m ~= i and not S.board[m] then
      sleep(180)
      S.board[m] = { t = 'X', p = { uid = -2, type = 'plain', temp = true, mirrored = true }, fresh = true }
      sfx.place(); ui.render(); ui.pop(ui.cellEl(m), t('pop.mirror'), 'info')
    end
  end

  local fresh = newXLines()
  if #fresh > 0 then
    util.push_all(S.g.scored, fresh); ui.render()
    sleep(250)
    for _, li in ipairs(fresh) do scoreLine(li, #fresh, threatsBefore) end
    ui.render()
  end
  if S.round.score >= S.round.target then sleep(500); return winBlind() end
  if #fresh > 0 and not hasJ('overtime') then return endGame('win') end

  local free = S.g.haste or p.type == 'ghost' or (hasJ('doubletap') and S.g.placements == 1)
  if S.g.haste and p.type ~= 'ghost' then S.g.haste = false end
  local live = #emptyCells() > 0 and #viableLines() > 0
  if free and live then ui.pop(ui.cellEl(i), t('pop.free'), 'info') end
  if not free and live then
    sleep(380)
    local oi = M.aiMove(); sfx.o(); ui.render()
    if oWon() then
      local guard = jokerOf('guardian')
      if guard and rng.random() < .5 and oi ~= nil then
        sleep(250); S.board[oi] = false
        ui.pop(ui.cellEl(oi), t('pop.fizzled'), 'info'); ui.jig(ui.jokerEl(guard.uid)); ui.render()
      else sleep(300); return endGame('busted') end
    end
  end
  refill()
  local fin
  if #emptyCells() == 0 then fin = 'full' elseif #viableLines() == 0 then fin = 'dry' end
  if fin then return endGame(fin) end
  S.busy = false; settle()
end

--[[ The rival. It takes a winning square if it sees one, blocks your
   two-in-a-row with a probability that rises every ante, and otherwise picks
   the square that best builds its own lines while getting in your way, with
   some noise so it is not predictable. Returns the cell it took, or nil. ]]
function M.aiMove()
  local E = emptyCells(); if #E == 0 then return nil end
  S.g.aiMoves = S.g.aiMoves + 1
  local a, master = math.min(S.ante, 10), isBoss('master')
  local blockP = math.min(.9, .3 + .08 * (a - 1)) + (master and .35 or 0) - (hasJ('sleepy') and .25 or 0)
  blockP = math.max(0, math.min(.97, blockP))
  local winP = master and 1 or math.min(1, .55 + .07 * (a - 1))
  local G = geo()
  local pick = nil
  if hasJ('bully') and S.g.aiMoves == 1 then pick = rand(E) end
  local function completing(who)
    local out = {}
    for li, l in ipairs(G.lines) do
      local n, em, last = 0, 0, nil
      for _, i in ipairs(l.cells) do
        local c = S.board[i]
        if c and c.t == who then n = n + 1 end
        if not c then em = em + 1; last = i end
      end
      if n == 2 and em == 1 and (who == 'O' or not includes(S.g.scored, li)) then out[#out + 1] = last end
    end
    return out
  end
  if pick == nil then
    local w = completing('O')
    if #w > 0 and rng.random() < winP then pick = rand(w) end
  end
  if pick == nil then
    local th = completing('X')
    if #th > 0 and rng.random() < blockP then pick = rand(th) end
  end
  if pick == nil then
    local bestScore = -1e9
    for _, i in ipairs(E) do
      local s = G.through[i] * 0.6
      for li, l in ipairs(G.lines) do
        if includes(l.cells, i) then
          local nx, no, ns = 0, 0, 0
          for _, j in ipairs(l.cells) do
            local c = S.board[j]
            if c then
              if c.t == 'X' then nx = nx + 1 elseif c.t == 'O' then no = no + 1 elseif c.t == 'S' then ns = ns + 1 end
            end
          end
          if nx == 0 and ns == 0 then s = s + 1.4 * no end
          if no == 0 and ns == 0 and not includes(S.g.scored, li) then s = s + blockP * nx end
        end
      end
      s = s + rng.random() * 2.5
      if s > bestScore then bestScore = s; pick = i end
    end
  end
  if pick == nil then return nil end
  S.board[pick] = { t = 'O', fresh = true }
  return pick
end

--[[ =================================================================
   Scoring
   ================================================================= ]]
-- Apply one effect with its popup and sound.
local function apply(ctx, e, target)
  if target and target.kind == 'joker' then ui.jig(target) end
  if nz(e.chips) then
    ctx.chips = ctx.chips + e.chips; ui.pop(target, '+' .. fmt(e.chips), 'chips'); sfx.chips(); ui.setCalc(ctx.chips, ctx.mult); ui.bumpCalc('chips')
    sleep((nz(e.mult) or nz(e.xmult) or nz(e.money)) and 190 or 280)
  end
  if nz(e.mult) then
    ctx.mult = ctx.mult + e.mult; ui.pop(target, t('pop.mult', { n = fmtM(e.mult) }), 'mult'); sfx.mult(); ui.setCalc(ctx.chips, ctx.mult); ui.bumpCalc('mult')
    sleep((nz(e.xmult) or nz(e.money)) and 190 or 280)
  end
  if nz(e.xmult) then
    ctx.mult = ctx.mult * e.xmult; ui.pop(target, t('pop.xmult', { n = fmtM(e.xmult) }), 'xmult'); sfx.xmult(); ui.setCalc(ctx.chips, ctx.mult); ui.bumpCalc('mult')
    sleep(nz(e.money) and 220 or 360)
  end
  if nz(e.money) then
    S.money = S.money + e.money; ui.pop(target, '+$' .. e.money, 'money'); sfx.money(); ui.setMoney(); sleep(260)
  end
end

-- One X scoring, including its retriggers.
local function scoreX(ctx, i, isFirst)
  local p = S.board[i].p
  local P, target, sq = PIECES[p.type], ui.cellEl(i), squareOf(i)
  local thief = isBoss('thief')
  local reps = 1 + (P.retrig or 0) + (sq.echo or 0) + ((isFirst and hasJ('echoj')) and 1 or 0)
  local squareTimes = hasJ('grandstand') and 2 or 1
  for r = 0, reps - 1 do
    if r > 0 then ui.pop(target, t('pop.again'), 'info'); sleep(220) end
    if nz(P.chips) then apply(ctx, { chips = P.chips }, target) end
    if nz(P.mult) then apply(ctx, { mult = P.mult }, target) end
    if nz(P.xmult) then apply(ctx, { xmult = (p.type == 'glass' and hasJ('glassjaw')) and 3 or P.xmult }, target) end
    if p.type == 'gold' and not thief then apply(ctx, { money = 2 }, target) end
    if p.type == 'lucky' then
      if rng.random() < 1 / 3 then apply(ctx, { mult = 15 }, target) end
      if rng.random() < 1 / 12 then apply(ctx, { money = 10 }, target) end
    end
    for _ = 1, squareTimes do
      if nz(sq.rich) then apply(ctx, { chips = 30 * sq.rich }, target) end
      if nz(sq.hot) then apply(ctx, { mult = 4 * sq.hot }, target) end
      if nz(sq.gild) and not thief then apply(ctx, { money = sq.gild }, target) end
    end
    for _, j in ipairs(S.jokers) do
      local d = JOKERS[j.id]
      if d.x then
        local e = d.x(ctx, i, p, j)
        if e then apply(ctx, e, ui.jokerEl(j.uid)) end
      end
    end
  end
end

-- Shared by lines and draws: X's in order, held Steel, Jokers, then the total.
local function runScore(ctx, label)
  resetStep()
  ui.setCalc(ctx.chips, ctx.mult, label); sfx.line(); ui.bumpCalc('chips'); ui.bumpCalc('mult')
  ui.markCells(ctx.cells, 'scoring', true)
  sleep(480)
  for k = 1, #ctx.cells do scoreX(ctx, ctx.cells[k], k == 1) end

  local held = {}
  for i = 1, #S.board do
    local c = S.board[i]
    if c and c.t == 'X' and c.p.type == 'steel' and not c.shattered and not includes(ctx.cells, i) then held[#held + 1] = i end
  end
  for _, i in ipairs(held) do
    ui.markCells({ i }, 'held', true)
    apply(ctx, { xmult = hasJ('ironclad') and 2 or 1.5 }, ui.cellEl(i))
    ui.markCells({ i }, 'held', false)
  end
  for _, j in ipairs(S.jokers) do
    local d = JOKERS[j.id]
    if d.line then
      local e = d.line(ctx, j)
      if e then apply(ctx, e, ui.jokerEl(j.uid)) end
    end
    if j.ed and EDITIONS[j.ed] then apply(ctx, EDITIONS[j.ed].effect, ui.jokerEl(j.uid)) end
  end

  local total = math.floor(ctx.chips * ctx.mult)
  sfx.score(); ui.showTotal(total); ui.pop(ui.boardEl(), '+' .. fmt(total), 'money')
  -- Half the blind's target is a nudge; the whole target (or more) is the full shake.
  local hit = total / math.max(1, S.round.target)
  if hit > 0.5 then ui.shake((hit - 0.5) * 2) end
  local from = S.round.score; S.round.score = S.round.score + total
  for s = 1, 14 do ui.setRoundScore(from + total * s / 14); sleep(28) end

  S.played[ctx.type] = S.played[ctx.type] + 1; S.stats.lines = S.stats.lines + 1
  if total > S.stats.bestLine then S.stats.bestLine = total; S.stats.bestType = ctx.type end
  for _, i in ipairs(ctx.cells) do
    local c = S.board[i]
    if c and c.p and c.p.type == 'glass' and not c.shattered and (hasJ('glassjaw') or rng.random() < .25) then
      c.shattered = true
      S.bag = util.filter(S.bag, function(q) return q.uid ~= c.p.uid end)
      ui.pop(ui.cellEl(i), t('pop.shattered'), 'dim'); sfx.bad()
    end
  end
  ui.refreshRack()
  sleep(420)
  ui.markCells(ctx.cells, 'scoring', false)
  ui.setCalc(0, 0, '')
end

function scoreLine(li, simult, threatsOpen)
  local l = geo().lines[li]
  local v = lineValues(l.type)
  runScore({ type = l.type, li = li, cells = l.cells, chips = v.chips, mult = v.mult, simult = simult, forked = threatsOpen >= 2, threats = threatsOpen },
    { name = tr(LINE_TYPES[l.type].name), lvl = t('lvl', { n = S.levels[l.type] }) })
  S.g.lines = S.g.lines + 1
end
local function scoreDraw()
  local cells = {}
  for i = 1, #S.board do local c = S.board[i]; if c and c.t == 'X' then cells[#cells + 1] = i end end
  local v = lineValues('draw')
  runScore({ type = 'draw', li = 0, cells = cells, chips = v.chips, mult = v.mult, simult = 0, forked = false, threats = 0 },
    { name = tr(LINE_TYPES.draw.name), lvl = t('lvl', { n = S.levels.draw }) })
end

function endGame(reason)
  S.busy = true; ui.render()
  if reason == 'win' then
    S.stats.wins = S.stats.wins + 1; ui.banner(t('banner.win')); sfx.win()
  elseif reason == 'busted' then
    ui.banner(t('banner.busted'), true); sfx.bad()
    local sl = jokerOf('soreloser')
    if sl then S.money = S.money + 3; ui.setMoney(); ui.pop(ui.jokerEl(sl.uid), '+$3', 'money'); sfx.money() end
  elseif S.g.lines == 0 then
    local b = ui.banner(t('banner.draw')); sleep(700); if b then b.remove() end
    scoreDraw()
    if S.round.score >= S.round.target then sleep(400); return winBlind() end
    ui.banner(t('banner.draw'))
  else
    ui.banner(reason == 'full' and t('banner.full') or t('banner.dry'))
  end

  sleep(1200)
  S.round.games = S.round.games - 1
  S.busy = false
  if S.round.games <= 0 then return gameOver() end
  newGame()
end

function gameOver()
  S.phase = 'over'; S.busy = false
  saveBest(); clearRun(); sfx.bad(); ui.render()
end

function winBlind()
  sfx.win()
  local r, rows, notes = S.round, {}, {}
  rows[#rows + 1] = { t('cash.cleared', { name = r.name }), r.reward }
  local left = math.max(0, r.games - 1)
  rows[#rows + 1] = { left == 1 and t('cash.unused1') or t('cash.unused', { n = left }), left }
  rows[#rows + 1] = { t('cash.interest'), math.min(5, math.floor(S.money / 5)) }
  for _, j in ipairs(S.jokers) do
    local d = JOKERS[j.id]
    if d.endRound then rows[#rows + 1] = { d.name, d.endRound(j) } end
  end
  local boom = {}
  for _, j in ipairs(S.jokers) do
    if j.id == 'banana' and rng.random() < .2 then boom[#boom + 1] = j end
  end
  if #boom > 0 then
    S.jokers = util.filter(S.jokers, function(j) return not includes(boom, j) end)
    notes[#notes + 1] = t('cash.banana')
  end
  local total = 0
  for _, row in ipairs(rows) do total = total + row[2] end
  S.cashout = { rows = rows, notes = notes, total = total, finalWin = false }
  S.phase = 'cashout'; S.mode = nil; S.busy = false
  if S.blindIdx == 2 then
    S.cashout.finalWin = S.ante == 8 and not S.endless
    S.ante = S.ante + 1; S.blindIdx = 0; nextBoss()
  else S.blindIdx = S.blindIdx + 1 end
  saveBest(); makeShop(); settle()
end

local function cashOut()
  if S.phase ~= 'cashout' then return end
  S.money = S.money + S.cashout.total; sfx.money()
  local fin = S.cashout.finalWin
  S.cashout = nil; S.phase = fin and 'won' or 'shop'
  settle()
end

local function skipBlind()
  if S.phase ~= 'blind' or S.blindIdx > 1 then return end
  if #S.items >= S.itemSlots then ui.toast(t('toast.itemsFull')); return end
  S.items[#S.items + 1] = { uid = nid(), id = rand(data.ITEMS_ORDER) }
  sfx.line(); ui.toast(t('toast.skipped'))
  S.blindIdx = S.blindIdx + 1; settle()
end

--[[ =================================================================
   Shop
   ================================================================= ]]
-- A Joker the run can use right now (board-size Jokers wait for a bigger board).
local function genJoker(edBoost, avoid)
  edBoost = edBoost or 1; avoid = avoid or {}
  local rr = rng.random()
  local rar = rr < .1 and 3 or (rr < .38 and 2 or 1)
  local function ok(id)
    if hasJ(id) or includes(avoid, id) then return false end
    if JOKERS[id].req and not JOKERS[id].req() then return false end
    if S.shop then for _, it in ipairs(S.shop.items) do if it.id == id then return false end end end
    return true
  end
  local order = data.JOKERS_ORDER
  local pool = util.filter(order, function(id) return JOKERS[id].rar == rar and ok(id) end)
  if #pool == 0 then pool = util.filter(order, ok) end
  if #pool == 0 then pool = order end
  local id = rand(pool)
  -- One roll decides the finish: 3% polychrome, 6% holographic, 10% foil (boosted in Joker Packs).
  local ed, edRoll = nil, rng.random()
  for _, k in ipairs({ 'poly', 'holo', 'foil' }) do
    local ch = EDITIONS[k].chance * edBoost
    if edRoll < ch then ed = k; break end
    edRoll = edRoll - ch
  end
  return { kind = 'joker', id = id, ed = ed, cost = JOKERS[id].cost + (ed and EDITIONS[ed].cost or 0), sold = false }
end
local function genItem()
  local roll = rng.random()
  if roll < .5 then return genJoker() end
  if roll < .75 then
    local id = rand(SPECIALS)
    return { kind = 'piece', id = id, cost = PIECES[id].cost, sold = false }
  end
  local chalks, tools = {}, {}
  for _, id in ipairs(data.ITEMS_ORDER) do
    if ITEMS[id].kind == 'chalk' then chalks[#chalks + 1] = id else tools[#tools + 1] = id end
  end
  return { kind = 'item', id = rng.random() < .6 and rand(chalks) or rand(tools), cost = 3, sold = false }
end
function makeShop()
  S.shop = { items = {}, tile = nil, voucher = nil, vSold = false, reroll = includes(S.vouchers, 'coupon') and 2 or 5, trimmed = false }
  S.shop.tile = { kind = 'tile', id = rand(data.TILES_ORDER), cost = 4, sold = false }
  for _ = 1, 3 do S.shop.items[#S.shop.items + 1] = genItem() end
  local kinds = shuffle(util.map(data.PACKS_ORDER, function(x) return x end))
  S.shop.packs = {}
  for k = 1, 2 do S.shop.packs[k] = { type = kinds[k], cost = PACKS[kinds[k]].cost, sold = false } end
  local vs = util.filter(data.VOUCHERS_ORDER, function(v) return not includes(S.vouchers, v) and (not VOUCHERS[v].req or VOUCHERS[v].req()) end)
  if #vs > 0 and S.lastVoucherAnte ~= S.ante then S.shop.voucher = rand(vs) end
end

-- key: 'v' (voucher), 't' (square upgrade) or 'i<n>' (shop slot n, 1-based)
local function buy(key)
  local sh = S.shop
  if S.phase ~= 'shop' or not sh or S.mode or S.pack then return end
  if key == 'v' then
    if not sh.voucher or sh.vSold then return end
    if S.money < 10 then ui.toast(t('toast.noMoney')); return end
    S.money = S.money - 10; sh.vSold = true; S.vouchers[#S.vouchers + 1] = sh.voucher; VOUCHERS[sh.voucher].apply(); S.lastVoucherAnte = S.ante; sfx.win()
    if sh.voucher == 'board4' or sh.voucher == 'board5' then ui.toast(t('toast.board', { n = S.N })) end
    settle(); return
  end
  local it
  if key == 't' then it = sh.tile else it = sh.items[tonumber(key:sub(2))] end
  if not it or it.sold then return end
  if S.money < it.cost then ui.toast(t('toast.noMoney')); return end
  if it.kind == 'joker' then
    if #S.jokers >= S.jokerSlots then ui.toast(t('toast.jokersFull')); return end
    S.jokers[#S.jokers + 1] = { uid = nid(), id = it.id, ed = it.ed, data = {} }
  elseif it.kind == 'piece' then
    S.bag[#S.bag + 1] = newPiece(it.id); ui.toast(t('toast.pieceAdded', { name = tr(PIECES[it.id].name) }))
  elseif it.kind == 'tile' then
    S.mode = 'tile'; S.pending = it.id
  else
    if #S.items >= S.itemSlots then ui.toast(t('toast.itemsFull')); return end
    S.items[#S.items + 1] = { uid = nid(), id = it.id }
  end
  S.money = S.money - it.cost; it.sold = true; sfx.money()
  if S.mode == 'tile' then ui.render() else settle() end
end
local function applyTile(i)
  if S.mode ~= 'tile' then return end
  local key = geometry.squareKey(i)
  local sq = S.squares[key]
  if not sq then sq = {}; S.squares[key] = sq end
  sq[S.pending] = (sq[S.pending] or 0) + 1
  ui.toast(t('toast.tileApplied', { name = tr(TILES[S.pending].name) }))
  S.mode = nil; S.pending = nil; S.shop.tileFromPack = false; sfx.win(); settle()
end
local function cancelTile()
  if S.mode ~= 'tile' then return end
  -- A tile from the shop slot is refunded; one picked from a pack is simply dropped.
  if S.shop.tileFromPack then S.shop.tileFromPack = false
  else S.money = S.money + S.shop.tile.cost; S.shop.tile.sold = false end
  S.mode = nil; S.pending = nil; settle()
end
local function trim()
  local sh = S.shop; if not sh or sh.trimmed then return end
  if S.money < 3 then ui.toast(t('toast.noMoney')); return end
  local k = util.find_index(S.bag, function(p) return p.type == 'plain' end)
  if not k or #S.bag <= 5 then return end
  table.remove(S.bag, k); S.money = S.money - 3; sh.trimmed = true; sfx.click(); ui.toast(t('toast.trimmed')); settle()
end
local function reroll()
  local sh = S.shop; if not sh or S.mode or S.pack then return end
  if S.money < sh.reroll then ui.toast(t('toast.noMoney')); return end
  S.money = S.money - sh.reroll; sh.reroll = sh.reroll + 1; sh.items = {}
  for _ = 1, 3 do sh.items[#sh.items + 1] = genItem() end
  sfx.click(); settle()
end
local function nextRound()
  if S.phase ~= 'shop' or S.mode or S.pack then return end
  sfx.click(); S.phase = 'blind'; S.shop = nil; settle()
end

--[[ ---------------- booster packs ---------------- ]]
local function packOptions(ty)
  local P = PACKS[ty]
  if ty == 'joker' then
    local out = {}
    for _ = 1, P.show do
      out[#out + 1] = genJoker(2.5, util.map(out, function(o) return o.id end))
    end
    return out
  end
  local function take(ids, kind)
    local out = {}
    for k = 1, math.min(P.show, #ids) do out[k] = { kind = kind, id = ids[k] } end
    return out
  end
  if ty == 'piece' then
    local ids = {}
    for _, id in ipairs(SPECIALS) do ids[#ids + 1] = id end
    return take(shuffle(ids), 'piece')
  end
  if ty == 'chalk' then
    return take(shuffle(util.filter(data.ITEMS_ORDER, function(i) return ITEMS[i].kind == 'chalk' end)), 'item')
  end
  if ty == 'builder' then
    return take(shuffle(util.map(data.TILES_ORDER, function(x) return x end)), 'tile')
  end
  return take(shuffle(util.filter(data.ITEMS_ORDER, function(i) return ITEMS[i].kind == 'tool' end)), 'item')
end
local function buyPack(k)
  local sh = S.shop
  local pk = sh and sh.packs and sh.packs[k]
  if S.phase ~= 'shop' or S.mode or S.pack or not pk or pk.sold then return end
  if S.money < pk.cost then ui.toast(t('toast.noMoney')); return end
  S.money = S.money - pk.cost; pk.sold = true; sfx.win()
  S.pack = { type = pk.type, options = packOptions(pk.type), left = PACKS[pk.type].choose }
  settle()
end
local function takePack(k)
  local pk = S.pack; if not pk then return end
  local o = pk.options[k]; if not o or o.taken then return end
  if o.kind == 'joker' then
    if #S.jokers >= S.jokerSlots then ui.toast(t('toast.jokersFull')); return end
    S.jokers[#S.jokers + 1] = { uid = nid(), id = o.id, ed = o.ed, data = {} }
  elseif o.kind == 'piece' then
    S.bag[#S.bag + 1] = newPiece(o.id); ui.toast(t('toast.pieceAdded', { name = tr(PIECES[o.id].name) }))
  elseif o.kind == 'tile' then
    S.pack = nil; S.mode = 'tile'; S.pending = o.id; S.shop.tileFromPack = true; sfx.win(); ui.render(); return
  elseif ITEMS[o.id].kind == 'chalk' then
    local d = ITEMS[o.id]; S.levels[d.lt] = S.levels[d.lt] + 1
    ui.toast(t('toast.level', { name = tr(LINE_TYPES[d.lt].name), n = S.levels[d.lt] }))
  else
    if #S.items >= S.itemSlots then ui.toast(t('toast.itemsFull')); return end
    S.items[#S.items + 1] = { uid = nid(), id = o.id }
  end
  o.taken = true; pk.left = pk.left - 1; sfx.money()
  if pk.left <= 0 then S.pack = nil end
  settle()
end
local function skipPack() if not S.pack then return end; S.pack = nil; sfx.click(); settle() end

--[[ =================================================================
   Jokers and items in the rack
   ================================================================= ]]
function M.jokerSellValue(j)
  return math.max(1, math.floor((JOKERS[j.id].cost + ((j.ed and EDITIONS[j.ed]) and EDITIONS[j.ed].cost or 0)) / 2))
end
local function findByUid(list, uid) for _, x in ipairs(list) do if x.uid == uid then return x end end end
local function sellJoker(uid)
  if S.busy then return end
  local j = findByUid(S.jokers, uid); if not j then return end
  S.money = S.money + M.jokerSellValue(j)
  S.jokers = util.filter(S.jokers, function(x) return x ~= j end); sfx.money(); settle()
end
local function sellItem(uid)
  if S.busy then return end
  S.items = util.filter(S.items, function(x) return x.uid ~= uid end); S.money = S.money + 1; sfx.money(); settle()
end
-- Reason an item can't be used right now, or '' if it can.
local function itemBlocked(uid)
  local c = findByUid(S.items, uid); if not c then return ' ' end
  local d = ITEMS[c.id]
  if S.busy then return t('why.busy') end
  if d.kind == 'chalk' or d.need == 'any' then return '' end
  if S.phase ~= 'play' then return t('why.round') end
  if S.mode then return t('why.mode') end
  if d.need == 'board' then
    for i = 1, #S.board do if S.board[i] and S.board[i].t == 'O' then return '' end end
    return t('why.noO')
  end
  if d.need == 'play' then return S.g.haste and t('why.active') or '' end
  return ''
end
local function useItem(uid)
  if itemBlocked(uid) ~= '' then return end
  local c = findByUid(S.items, uid); local d = ITEMS[c.id]
  local function drop() S.items = util.filter(S.items, function(x) return x ~= c end) end
  if d.kind == 'chalk' then
    S.levels[d.lt] = S.levels[d.lt] + 1; drop(); sfx.win()
    ui.toast(t('toast.level', { name = tr(LINE_TYPES[d.lt].name), n = S.levels[d.lt] }))
  elseif c.id == 'miser' then
    local g = math.min(20, S.money); S.money = S.money + g; drop(); sfx.money(); ui.toast(t('toast.money', { n = g }))
  elseif c.id == 'forge' then
    local plains = util.filter(S.bag, function(p) return p.type == 'plain' end)
    if #plains == 0 then ui.toast(t('toast.noPlain')); return end
    local p = rand(plains); p.type = rand(SPECIALS); drop(); sfx.win()
    ui.toast(t('toast.forged', { name = tr(PIECES[p.type].name) }))
  elseif c.id == 'eraser' then
    S.mode = 'erase'; S.pending = c.uid; ui.render(); return
  elseif c.id == 'sprint' then
    S.g.haste = true; drop(); sfx.line(); ui.toast(t('toast.free'))
  end
  settle()
end
local function cancelMode()
  if S.mode == 'erase' then S.mode = nil; S.pending = nil; ui.render()
  elseif S.mode == 'tile' then cancelTile() end
end

--[[ =================================================================
   Run lifecycle and settings
   ================================================================= ]]
local function newRun() sfx.click(); ui.showModal(nil); clearRun(); freshRun(); settle() end
local function continueRun()
  sfx.click(); ui.showModal(nil)
  if not loadRun() then freshRun() end
  settle()
end
local function abandon() clearRun(); S.phase = 'title'; ui.render() end
local function endless() S.endless = true; S.phase = 'shop'; settle() end
local function toggleSpeed() SET.speed = SET.speed == 1 and 2 or (SET.speed == 2 and 4 or 1); saveSettings(); ui.render(); ui.refreshModal() end
local function toggleSound() SET.sound = not SET.sound; saveSettings(); ui.render(); ui.refreshModal(); sfx.click() end
local function toggleCrt() SET.crt = not SET.crt; saveSettings(); ui.applyCrt(); ui.render(); ui.refreshModal(); sfx.click() end

-- Developer hook (autoplay showcase): open a fresh shop without playing a blind.
function M.finishForShowcase() S.phase = 'shop'; S.mode = nil; S.busy = false; makeShop(); S.shop.voucher = 'board5'; ui.render() end

M.actions = {
  cell = onCell, selectPiece = selectPiece, discard = discard, startBlind = startBlind, skipBlind = skipBlind,
  buy = buy, reroll = reroll, trim = trim, applyTile = applyTile, cancelTile = cancelTile, nextRound = nextRound, cashOut = cashOut,
  buyPack = buyPack, takePack = takePack, skipPack = skipPack,
  sellJoker = sellJoker, sellItem = sellItem, useItem = useItem, itemBlocked = itemBlocked, cancelMode = cancelMode,
  newRun = newRun, continueRun = continueRun, abandon = abandon, endless = endless,
  toggleSpeed = toggleSpeed, toggleSound = toggleSound, toggleCrt = toggleCrt,
}

return M
