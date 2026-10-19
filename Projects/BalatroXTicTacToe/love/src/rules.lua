-- Pure rule helpers shared by the engine and the interface: starting a run,
-- blind targets, score-type values, board queries. Nothing here draws or waits.
local state = require('src.state')
local geometry = require('src.geometry')
local data = require('src.data')
local rng = require('src.rng')
local strings = require('src.strings')
local util = require('src.util')
local S, nid = state.S, state.nid
local geo = geometry.geo
local t, tr = strings.t, strings.tr

local M = {}

function M.rand(a) return a[math.floor(rng.random() * #a) + 1] end

-- Fisher-Yates, same draw order as the JS version.
function M.shuffle(a)
  for i = #a, 2, -1 do
    local j = math.floor(rng.random() * i) + 1
    a[i], a[j] = a[j], a[i]
  end
  return a
end

function M.newPiece(ty) return { uid = nid(), type = ty } end

local function pickBoss()
  local used = S.usedBosses or {}
  local pool = util.filter(data.BOSSES_ORDER, function(b) return not util.includes(used, b) end)
  return { id = M.rand(#pool > 0 and pool or data.BOSSES_ORDER) }
end
function M.nextBoss() S.boss = pickBoss(); S.usedBosses[#S.usedBosses + 1] = S.boss.id end

function M.freshRun()
  for k in pairs(S) do S[k] = nil end
  local bag = {}
  for i = 1, 8 do bag[i] = M.newPiece('plain') end
  local board = {}
  for i = 1, 9 do board[i] = false end
  for k, v in pairs({
    phase = 'blind', ante = 1, blindIdx = 0, money = 4, N = 3,
    bag = bag, hand = {}, selIdx = 1, squares = {},
    jokers = {}, items = {}, levels = { row = 1, col = 1, diag = 1, draw = 1 }, played = { row = 0, col = 0, diag = 0, draw = 0 },
    vouchers = {}, maxGames = 4, maxDiscards = 3, handSize = 3, jokerSlots = 5, itemSlots = 2,
    usedBosses = {}, board = board, lastVoucherAnte = 0,
    stats = { bestLine = 0, bestType = '', lines = 0, wins = 0 }, endless = false, busy = false,
  }) do S[k] = v end
  M.nextBoss()
end

-- Target, reward and label for blind 0 (small), 1 (big) or 2 (boss) of the current ante.
function M.blindInfo(idx)
  local a = S.ante
  local base
  if a <= 8 then base = data.ANTE_BASE[a] else base = util.round(50000 * 2 ^ (a - 8) / 100) * 100 end
  if idx == 2 then
    local b = data.BOSSES[S.boss.id]
    local m = S.boss.id == 'needle' and 1.5 or 2
    return { name = tr(b.name), target = util.round(base * m), reward = 5, color = b.color, desc = tr(b.desc), boss = true }
  end
  if idx == 0 then
    return { name = t('blind.small'), target = base, reward = 3, color = '#2f6f9f', desc = t('blind.smallDesc'), boss = false }
  end
  return { name = t('blind.big'), target = util.round(base * 1.5), reward = 4, color = '#b8862a', desc = t('blind.bigDesc'), boss = false }
end

-- Base chips and mult of a score type at its current level.
function M.lineValues(ty)
  local h, l = data.LINE_TYPES[ty], S.levels[ty]
  return { chips = h.c + h.dc * (l - 1), mult = h.m + h.dm * (l - 1) }
end

function M.handMax() return S.handSize + (data.hasJ('scout') and 1 or 0) end
-- Boss effects only apply while the boss blind is being played.
function M.isBoss(id) return S.phase == 'play' and S.blindIdx == 2 and S.boss ~= nil and S.boss.id == id end

-- Board queries (cells and lines are 1-based) --------------------------------
function M.emptyCells()
  local out = {}
  for i = 1, #S.board do if not S.board[i] then out[#out + 1] = i end end
  return out
end
local function cellsOf(li)
  local cs = geo().lines[li].cells
  return S.board[cs[1]], S.board[cs[2]], S.board[cs[3]]
end
function M.oWon()
  for _, l in ipairs(geo().lines) do
    local ok = true
    for _, i in ipairs(l.cells) do local c = S.board[i]; if not (c and c.t == 'O') then ok = false; break end end
    if ok then return true end
  end
  return false
end
-- Lines that just became three X's and have not scored yet.
function M.newXLines()
  local out = {}
  for li = 1, #geo().lines do
    if not util.includes(S.g.scored, li) then
      local a, b, c = cellsOf(li)
      if a and a.t == 'X' and b and b.t == 'X' and c and c.t == 'X' then out[#out + 1] = li end
    end
  end
  return out
end
-- Lines X could still complete.
function M.viableLines()
  local out = {}
  for li = 1, #geo().lines do
    if not util.includes(S.g.scored, li) then
      local a, b, c = cellsOf(li)
      if (not a or a.t == 'X') and (not b or b.t == 'X') and (not c or c.t == 'X') then out[#out + 1] = li end
    end
  end
  return out
end
-- Lines one X away from scoring.
function M.threats()
  local out = {}
  for li = 1, #geo().lines do
    if not util.includes(S.g.scored, li) then
      local a, b, c = cellsOf(li)
      local nx, ne = 0, 0
      for _, cell in ipairs({ a or false, b or false, c or false }) do
        if cell and cell.t == 'X' then nx = nx + 1 end
        if not cell then ne = ne + 1 end
      end
      if nx == 2 and ne == 1 then out[#out + 1] = li end
    end
  end
  return out
end

return M
