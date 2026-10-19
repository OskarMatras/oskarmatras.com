-- Game content. The static parts (names, costs, DA/EN text) come from
-- content_gen.lua, generated from the web game's data.js. The behaviour
-- (Joker hooks, voucher effects, requirement checks) is ported by hand here.
--
-- Hooks receive the scoring context and read the run state from state.lua.
-- They return an effect { chips=, mult=, xmult=, money= } or nil.
local gen = require('src.content_gen')
local state = require('src.state')
local geometry = require('src.geometry')
local util = require('src.util')
local S = state.S
local isCenter, isCorner, isEdge, neighbours, runLength, geo = geometry.isCenter, geometry.isCorner, geometry.isEdge, geometry.neighbours, geometry.runLength, geometry.geo

local M = {}
for k, v in pairs(gen) do M[k] = v end

local function countO()
  local n = 0
  for i = 1, #S.board do local c = S.board[i]; if c and c.t == 'O' then n = n + 1 end end
  return n
end
local function filled() local n = 0; for i = 1, #S.board do if S.board[i] then n = n + 1 end end; return n end
local function hasJ(id) for _, j in ipairs(S.jokers) do if j.id == id then return true end end; return false end
M.hasJ = hasJ

-- Square-upgrade corner badges (the JS keeps these as functions).
M.TILE_BADGE = {
  hot = function(l) return '+' .. (4 * l) end,
  rich = function(l) return '+' .. (30 * l) end,
  gild = function(l) return '$' .. l end,
  echo = function(l) return '\226\134\187' .. (l > 1 and l or '') end, -- ↻
}

-- Per-Joker behaviour -------------------------------------------------------
local H = {}
H.jester = { line = function() return { mult = 4 } end }
H.center = { line = function(c) for _, i in ipairs(c.cells) do if isCenter(i) then return { mult = 10 } end end end }
H.corner = { x = function(c, i) if isCorner(i) then return { chips = 30 } end end }
H.edge = { x = function(c, i) if isEdge(i) then return { mult = 4 } end end }
H.speedrun = { line = function() if S.g.placements <= 3 then return { mult = 15 } end end }
H.spite = { line = function() local n = countO(); if n > 0 then return { mult = 3 * n } end end }
H.crowded = { line = function() return { mult = 2 * filled() } end }
H.rowfan = { line = function(c) if c.type == 'row' then return { mult = 8 } end end }
H.colfan = { line = function(c) if c.type == 'col' then return { mult = 8 } end end }
H.plainjane = { x = function(c, i, p) if p.type == 'plain' then return { chips = 15 } end end }
H.pennant = { line = function() if S.round.discards > 0 then return { chips = 25 * S.round.discards } end end }
H.goldtooth = { endRound = function() return 4 end }
H.jeweler = { x = function(c, i, p) if p.type == 'gold' then return { mult = 6 } end end }
H.diag = { line = function(c) if c.type == 'diag' then return { xmult = 2 } end end }
H.fork = { line = function(c) if c.forked then return { xmult = 2.5 } end end }
H.catsgame = { line = function(c) if c.type == 'draw' then return { xmult = 3, money = 2 } end end }
H.snowball = {
  desc = function(j)
    local m = (j and j.data.m) or 0
    return { en = 'Gains <em>+1</em> Mult every time you score (currently <em>+' .. m .. '</em>)', da = 'Får <em>+1</em> mult hver gang du scorer (lige nu <em>+' .. m .. '</em>)' }
  end,
  line = function(c, j) j.data.m = (j.data.m or 0) + 1; return { mult = j.data.m } end,
  val = function(j) return '+' .. (j.data.m or 0) end,
}
H.gallery = { line = function() return { mult = 3 * #S.jokers } end }
H.collector = { line = function()
  local n = 0
  for _, p in ipairs(S.bag) do if p.type ~= 'plain' then n = n + 1 end end
  if n > 0 then return { mult = 2 * n } end
end }
H.combo = { line = function()
  if S.g.lines > 0 then return { xmult = util.toFixed(1.5 ^ S.g.lines, 3) } end
end }
H.momentum = {
  desc = function(j)
    local x = string.format('%.1f', util.toFixed(1 + ((j and j.data.n) or 0) * 0.1, 1))
    local xd = x:gsub('%.', ',')
    return { en = 'Gains <em>X0.1</em> Mult every time you score (currently <em>X' .. x .. '</em>)', da = 'Får <em>X0,1</em> mult hver gang du scorer (lige nu <em>X' .. xd .. '</em>)' }
  end,
  line = function(c, j) j.data.n = (j.data.n or 0) + 1; return { xmult = util.toFixed(1 + j.data.n * 0.1, 2) } end,
  val = function(j) return 'X' .. string.format('%.1f', util.toFixed(1 + (j.data.n or 0) * 0.1, 1)) end,
}
H.banana = { line = function() return { xmult = 3 } end }
H.midas = { x = function(c, i, p) if p.type == 'gold' then return { xmult = 1.5 } end end }
H.longshot = {
  req = function() return S.N >= 4 end,
  line = function(c)
    if c.type == 'draw' then return nil end
    local n = runLength(geo().lines[c.li])
    if n >= 4 then return { xmult = n - 2 } end
  end,
}
H.bigsky = { req = function() return S.N >= 4 end, line = function() if S.N > 3 then return { xmult = 1 + 0.5 * (S.N - 3) } end end }
H.crossroads = { line = function(c)
  if c.type == 'draw' then return nil end
  local L = geo().lines
  local n = 0
  for _, i in ipairs(c.cells) do
    for _, li in ipairs(S.g.scored) do
      if li ~= c.li and util.includes(L[li].cells, i) then n = n + 1; break end
    end
  end
  if n > 0 then return { mult = 15 * n } end
end }
H.cartographer = { line = function()
  local n = 0
  for i = 1, #S.board do if not S.board[i] then n = n + 1 end end
  if n > 0 then return { chips = 8 * n } end
end }
H.landlord = { line = function()
  local n = 0
  for i = 1, #S.board do local x = S.board[i]; if x and x.t == 'X' then n = n + 1 end end
  return { mult = n }
end }
H.pincer = { line = function(c)
  local os, n = {}, 0
  for _, i in ipairs(c.cells) do
    for _, k in ipairs(neighbours(i)) do
      if S.board[k] and S.board[k].t == 'O' and not os[k] then os[k] = true; n = n + 1 end
    end
  end
  if n > 0 then return { chips = 25 * n } end
end }
H.hermit = { line = function(c)
  if c.type == 'draw' then return nil end
  for _, i in ipairs(c.cells) do
    for _, k in ipairs(neighbours(i)) do
      if S.board[k] and S.board[k].t == 'O' then return nil end
    end
  end
  return { xmult = 2 }
end }
H.checkmate = { line = function(c) if c.threats >= 3 then return { xmult = 3 } end end }
H.demolition = {
  desc = function(j)
    local m = (j and j.data.m) or 0
    return { en = 'Gains <em>+3</em> Mult every time a Bomb X blows up an O (currently <em>+' .. m .. '</em>)', da = 'Får <em>+3</em> mult hver gang et Bombe X sprænger et O (lige nu <em>+' .. m .. '</em>)' }
  end,
  line = function(c, j) if (j.data.m or 0) > 0 then return { mult = j.data.m } end end,
  val = function(j) return '+' .. (j.data.m or 0) end,
}
H.ghosttown = { x = function(c, i, p) if p.type == 'ghost' then return { xmult = 1.5 } end end }
H.reflection = { x = function(c, i, p) if p.type == 'mirror' or p.mirrored then return { mult = 6 } end end }

-- What this Lua engine and view really implement ---------------------------------
-- content_gen.lua is regenerated from the web game's data.js, so it can list content the Lua port has
-- not learned yet (a new Joker, piece, boss...). Anything not named here is taken out of the Lua game's
-- shops and rotations (and listed in M.UNPORTED) instead of crashing it: regenerating is always safe, and
-- the work left is exactly the list that `node tools/sync.mjs` prints. To port something: write its
-- behaviour (Joker hook in H below, piece / boss / item code in engine.lua, art in widgets.lua), add its id
-- to the set here, and run the parity test.
local function set(t) local s = {}; for _, v in ipairs(t) do s[v] = true end; return s end
local PORTED = {
  jokers = require('src.ported').jokers,   -- id -> fingerprint of the web hooks when ported (the list of ported Jokers)
  pieces = set({ 'plain', 'red', 'blue', 'gold', 'lucky', 'glass', 'steel', 'bomb', 'ghost', 'mirror', 'twin' }),
  tiles = set({ 'hot', 'rich', 'gild', 'echo' }),
  items = set({ 'chalk_row', 'chalk_col', 'chalk_diag', 'chalk_draw', 'eraser', 'sprint', 'forge', 'miser' }),
  bosses = set({ 'wall', 'crowd', 'thief', 'master', 'needle', 'drought', 'echo' }),
  vouchers = set({ 'extragame', 'sparehand', 'pockets', 'rack', 'satchel', 'coupon', 'board4', 'board5' }),
  packs = set({ 'joker', 'piece', 'chalk', 'builder', 'tool', 'forge' }),
  editions = set({ 'foil', 'holo', 'poly' }),
}
M.UNPORTED = { jokers = {}, pieces = {}, tiles = {}, items = {}, bosses = {}, vouchers = {}, packs = {}, editions = {} }
local function prune(kind, order, tbl)
  local keep = {}
  for _, id in ipairs(M[order]) do
    if PORTED[kind][id] then keep[#keep + 1] = id
    else
      M.UNPORTED[kind][#M.UNPORTED[kind] + 1] = id
      if tbl then M[tbl][id] = nil end
    end
  end
  M[order] = keep
end
prune('jokers', 'JOKERS_ORDER', 'JOKERS')
-- A Joker the Lua port knows, but whose hooks changed in the web game since it was ported, is stale: keep it
-- out of the shops until it is ported again (see src/ported.lua and tools/sync.mjs).
do
  local ported = PORTED.jokers
  M.STALE = {}
  local keep = {}
  for _, id in ipairs(M.JOKERS_ORDER) do
    if gen.HOOK_HASH and gen.HOOK_HASH[id] and ported[id] ~= gen.HOOK_HASH[id] then
      M.STALE[#M.STALE + 1] = id; M.JOKERS[id] = nil
    else keep[#keep + 1] = id end
  end
  M.JOKERS_ORDER = keep
  if #M.STALE > 0 then print('[bxt] web hooks changed since ported (offline until re-ported): ' .. table.concat(M.STALE, ', ')) end
end
prune('pieces', 'PIECES_ORDER', nil)
M.SPECIALS = util.filter(M.SPECIALS, function(id) return PORTED.pieces[id] end)
prune('tiles', 'TILES_ORDER', 'TILES')
prune('items', 'ITEMS_ORDER', 'ITEMS')
prune('bosses', 'BOSSES_ORDER', 'BOSSES')
prune('vouchers', 'VOUCHERS_ORDER', 'VOUCHERS')
prune('packs', 'PACKS_ORDER', 'PACKS')
prune('editions', 'EDITIONS_ORDER', 'EDITIONS')
do
  local parts = {}
  for kind, ids in pairs(M.UNPORTED) do if #ids > 0 then parts[#parts + 1] = kind .. ' (' .. #ids .. '): ' .. table.concat(ids, ', ') end end
  if #parts > 0 then table.sort(parts); print('[bxt] not yet ported from the web game: ' .. table.concat(parts, ' | ')) end
end

-- Merge behaviour onto the generated metadata and check the pairing against
-- what the JS declared (hasLine/hasX/... come from the generator).
M.JOKER_HOOKS = H
for id, j in pairs(M.JOKERS) do
  local h = H[id] or {}
  j.line, j.x, j.endRound, j.req, j.val, j.descFn = h.line, h.x, h.endRound, h.req, h.val, h.desc
  -- (a mismatch here means a ported Joker's shape changed in the web game without its fingerprint changing: a bug in the port)
  assert((j.line ~= nil) == j.hasLine and (j.x ~= nil) == j.hasX and (j.endRound ~= nil) == j.hasEnd and (j.req ~= nil) == j.hasReq and (j.val ~= nil) == j.hasVal, 'hook shape mismatch: ' .. id)
end

-- Joker description (a table {en,da}); dynamic Jokers read their own data.
function M.jokerDesc(id, j)
  local d = M.JOKERS[id]
  if d.descFn then return d.descFn(j) end
  return d.desc
end

-- Vouchers: permanent effects and when they can appear ----------------------
local VA = {
  extragame = function() S.maxGames = S.maxGames + 1 end,
  sparehand = function() S.maxDiscards = S.maxDiscards + 1 end,
  pockets = function() S.handSize = S.handSize + 1 end,
  rack = function() S.jokerSlots = S.jokerSlots + 1 end,
  satchel = function() S.itemSlots = S.itemSlots + 1 end,
  coupon = function() end,
  board4 = function() S.N = 4 end,
  board5 = function() S.N = 5 end,
}
local VR = {
  board4 = function() return S.N == 3 and S.ante >= 2 end,
  board5 = function() return S.N == 4 end,
}
for id, v in pairs(M.VOUCHERS) do
  v.apply, v.req = VA[id], VR[id]
  assert(v.apply, 'voucher apply: ' .. id)
  assert((v.req ~= nil) == v.hasReq, 'voucher req: ' .. id)
end

return M
