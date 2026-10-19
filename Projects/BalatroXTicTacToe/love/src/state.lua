-- The whole run is one plain table, `S`. Nothing in it holds a function, so
-- saving is JSON.encode and loading is a copy back in. Modules require this
-- file and mutate S in place; the table never changes identity.
--
-- Cell indices in S are 1-based (the JS version is 0-based). The save keeps
-- the JS v=3 shape (same keys) but its indices are 1-based, so saves from the
-- web game and from this port are not interchangeable.
--
-- Storage is behind a small backend so the same code saves through
-- love.filesystem in the game and into memory in the headless tests.
local json = require('lib.json')

local M = {}
M.S = {}
M.SET = { speed = 1, sound = true, crt = true, lang = nil, fullscreen = false, uiSize = 2 }

local KEY_RUN, KEY_SET, KEY_BEST = 'run-v3.json', 'settings.json', 'best.json'
local uid = 1

function M.nid() local v = uid; uid = uid + 1; return v end
function M.getUid() return uid end

-- Backends -----------------------------------------------------------------
local mem = {}
M.backend = {
  read = function(name) return mem[name] end,
  write = function(name, data) mem[name] = data end,
  remove = function(name) mem[name] = nil end,
}
function M.use_love_filesystem()
  local fs = love.filesystem
  M.backend = {
    read = function(name) if fs.getInfo(name) then return (fs.read(name)) end end,
    write = function(name, data) fs.write(name, data) end,
    remove = function(name) fs.remove(name) end,
  }
end

local function read(key)
  local ok, v = pcall(function()
    local s = M.backend.read(key)
    return s and json.decode(s) or nil
  end)
  return ok and v or nil
end
local function write(key, value)
  pcall(function() M.backend.write(key, json.encode(value, { false_as_null = true })) end)
end

function M.loadSettings() local s = read(KEY_SET); if s then for k, v in pairs(s) do M.SET[k] = v end end end
function M.saveSettings() write(KEY_SET, M.SET) end

-- Saved only at settled moments (never mid-animation), so a restore always
-- lands in a consistent state.
function M.saveRun()
  local S = M.S
  if S.busy or not S.phase or S.phase == 'title' or S.phase == 'over' then return end
  write(KEY_RUN, { v = 3, S = S, uid = uid })
end
function M.clearRun() pcall(M.backend.remove, KEY_RUN) end
function M.hasSavedRun()
  local d = read(KEY_RUN)
  return not not (d and d.v == 3 and d.S and d.S.bag)
end

function M.replaceState(data, nextUid)
  local S = M.S
  for k in pairs(S) do S[k] = nil end
  for k, v in pairs(data) do S[k] = v end
  if nextUid then uid = nextUid end
  S.busy = false; S.mode = nil; S.pending = nil
end

function M.loadRun()
  local d = read(KEY_RUN)
  if not d or d.v ~= 3 or not d.S or not d.S.bag then return false end
  -- JSON drops nulls, so restore the board's explicit "empty" markers.
  local b = d.S.board
  if b then for i = 1, (d.S.N or 3) ^ 2 do if b[i] == nil then b[i] = false end end end
  M.replaceState(d.S, d.uid)
  return true
end

function M.snapshot() return json.decode(json.encode({ S = M.S, uid = uid }, { false_as_null = true })) end

function M.best() return read(KEY_BEST) or { ante = 0, score = 0 } end
function M.saveBest()
  local S = M.S
  local b = M.best()
  b.ante = math.max(b.ante or 0, S.ante or 0)
  b.score = math.max(b.score or 0, (S.stats and S.stats.bestLine) or 0)
  write(KEY_BEST, b)
end

return M
