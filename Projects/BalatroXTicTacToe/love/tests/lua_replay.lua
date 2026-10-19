-- Replays a trace recorded by tests/gen_trace.js on the Lua port and writes
-- the Lua side's digest after every action. tests/compare.js diffs the two.
-- Run through LÖVE:  lovec . --parity <js_trace.json> <lua_out.json>
local json = require('lib.json')
local state = require('src.state')
local rng = require('src.rng')
local strings = require('src.strings')
local audio = require('src.audio')
local rules = require('src.rules')
local data = require('src.data')
local geometry = require('src.geometry')
local engine = require('src.engine')

local S, nid = state.S, state.nid
local M = {}

local function slurp(path) local f = assert(io.open(path, 'rb')); local s = f:read('*a'); f:close(); return s end

-- Digest in the JS version's index space (0-based cells, lines and selIdx).
local function strip(v)
  if type(v) ~= 'table' then return v end
  local o = {}
  for k, x in pairs(v) do if k ~= 'fresh' and k ~= 'dealt' then o[k] = strip(x) end end
  return o
end
local function digest()
  local snap = state.snapshot()
  local s = snap.S
  s.selIdx = s.selIdx - 1
  if s.g then for i, li in ipairs(s.g.scored) do s.g.scored[i] = li - 1 end end
  return strip(snap)
end

local function applySetup(sp)
  S.ante = sp.ante; S.money = sp.money
  if sp.N then S.N = sp.N end
  S.board = {}
  for i = 1, S.N * S.N do S.board[i] = false end
  for _, j in ipairs(sp.jokers) do S.jokers[#S.jokers + 1] = { uid = nid(), id = j.id, ed = j.ed, data = {} } end
  for _, ty in ipairs(sp.bag) do S.bag[#S.bag + 1] = rules.newPiece(ty) end
  for _, id in ipairs(sp.items) do S.items[#S.items + 1] = { uid = nid(), id = id } end
  for key, v in pairs(sp.squares) do
    local c = {}
    for k, x in pairs(v) do c[k] = x end
    S.squares[key] = c
  end
  for k, v in pairs(sp.levels) do S.levels[k] = v end
  if sp.boss then S.boss = { id = sp.boss }; S.usedBosses[#S.usedBosses + 1] = sp.boss end
  S.jokerSlots = sp.jokerSlots; S.itemSlots = sp.itemSlots; S.handSize = sp.handSize
end

local function exec(act, arg)
  local a = engine.actions
  if act == 'setup' then return applySetup(arg) end
  if act == 'cell' or act == 'selectPiece' or act == 'applyTile' or act == 'buyPack' or act == 'takePack' then
    return a[act](tonumber(arg) + 1)
  elseif act == 'buy' then
    if arg:sub(1, 1) == 'i' then arg = 'i' .. (tonumber(arg:sub(2)) + 1) end
    return a.buy(arg)
  elseif act == 'sellJoker' or act == 'sellItem' or act == 'useItem' then
    return a[act](tonumber(arg))
  end
  return a[act](arg)
end

local function units()
  local u = { blind = {}, values = {}, geo = {} }
  rules.freshRun()
  for _, boss in ipairs(data.BOSSES_ORDER) do
    for a = 1, 12 do
      S.ante = a; S.boss = { id = boss }
      for idx = 0, 2 do
        local b = rules.blindInfo(idx)
        u.blind[#u.blind + 1] = { boss, a, idx, b.target, b.reward, b.name, b.desc }
      end
    end
  end
  S.ante = 1
  for _, ty in ipairs(data.LINE_ORDER) do
    for l = 1, 8 do
      S.levels[ty] = l
      local v = rules.lineValues(ty)
      u.values[#u.values + 1] = { ty, l, v.chips, v.mult }
    end
  end
  for N = 3, 5 do
    S.N = N
    local g = geometry.geo()
    local lines = {}
    for i, l in ipairs(g.lines) do lines[i] = { l.type, l.dr, l.dc, l.cells[1] - 1, l.cells[2] - 1, l.cells[3] - 1 } end
    u.geo[#u.geo + 1] = { N, #g.lines, lines, g.through }
  end
  return u
end

function M.run(inFile, outFile)
  audio.enabled = false
  local trace = json.decode(slurp(inFile))
  rng.seed(trace.seed)
  strings.setLang('en')
  rules.freshRun(); S.phase = 'title'
  local u = units()
  rules.freshRun(); S.phase = 'title'
  local out, err = {}, nil
  for n, step in ipairs(trace.steps) do
    local ok, e = xpcall(function() exec(step.act, step.arg) end, debug.traceback)
    if not ok then err = ('step %d (%s %s): %s'):format(n, step.act, tostring(step.arg), e); break end
    if engine.async == false and S.busy then err = ('step %d: still busy after %s'):format(n, step.act); end
    out[n] = digest()
    if err then break end
  end
  local f = assert(io.open(outFile, 'wb'))
  f:write(json.encode({ units = u, steps = out, err = err }, { false_as_null = true }))
  f:close()
  print(('lua seed %s: %d steps%s'):format(tostring(trace.seed), #out, err and (' ERROR ' .. err:match('[^\n]*')) or ''))
end

return M
