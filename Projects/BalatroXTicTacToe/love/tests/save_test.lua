-- Save / load round trip through the v=3 format (in-memory backend).
local json = require('lib.json')
local state = require('src.state')
local rng = require('src.rng')
local rules = require('src.rules')
local engine = require('src.engine')
local audio = require('src.audio')

local S = state.S
local M = {}

local function deepEqual(a, b, path)
  if type(a) ~= type(b) then return false, path .. ': type ' .. type(a) .. ' vs ' .. type(b) end
  if type(a) ~= 'table' then
    if a ~= b then return false, path .. ': ' .. tostring(a) .. ' vs ' .. tostring(b) end
    return true
  end
  for k, v in pairs(a) do
    local ok, why = deepEqual(v, b[k], path .. '.' .. tostring(k))
    if not ok then return false, why end
  end
  for k in pairs(b) do if a[k] == nil then return false, path .. '.' .. tostring(k) .. ' only in loaded' end end
  return true
end

function M.run()
  audio.enabled = false
  rng.seed(7)
  local act = engine.actions
  local checks, failed = 0, 0
  -- Play different amounts of several runs, save at each settled moment, reload and compare.
  for seed = 1, 6 do
    rng.seed(seed * 31)
    act.newRun()
    S.money = 200
    for step = 1, 40 do
      local p = S.phase
      if p == 'blind' then act.startBlind()
      elseif p == 'play' then
        local E = rules.emptyCells()
        if S.hand[1] then act.cell(E[1 + (step * 7) % #E]) end
      elseif p == 'cashout' then act.cashOut()
      elseif p == 'shop' then
        if S.pack then act.takePack(1) elseif S.mode == 'tile' then act.applyTile(1)
        else act.buy('i1'); act.buy('t'); act.buyPack(1); act.nextRound() end
      else break end
      state.saveRun()
      if S.phase ~= 'over' and S.phase ~= 'title' and not S.busy then
        local before = json.decode(json.encode({ S = S, uid = state.getUid() }, { false_as_null = true }))
        -- drop view-only flags the engine clears on render
        local saved = state.backend.read('run-v3.json')
        assert(saved and saved:find('"v":3'), 'save is not v=3')
        for k in pairs(S) do S[k] = nil end
        assert(state.loadRun(), 'loadRun failed')
        local after = json.decode(json.encode({ S = S, uid = state.getUid() }, { false_as_null = true }))
        after.S.busy, before.S.busy = nil, nil
        checks = checks + 1
        local ok, why = deepEqual(before, after, 'run')
        if not ok then failed = failed + 1; print('MISMATCH after step ' .. step .. ' (phase ' .. p .. '): ' .. why) end
      end
    end
  end
  print(('save/load round trip: %d checks, %d mismatches'):format(checks, failed))
  if failed > 0 then error('save test failed') end
end

return M
