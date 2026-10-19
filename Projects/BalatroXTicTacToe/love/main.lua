-- Entry point.
-- Normal launch:   love .
-- Developer tools (headless unless noted):
--   lovec . --check                          syntax-check every Lua file
--   lovec . --parity in.json out.json       replay a JS-recorded game on the Lua logic
--   lovec . --report                         list web content not ported to Lua yet (tools/sync.mjs runs this)
--   lovec . --savetest                      save / load round trip through the v=3 format
--   lovec . --autoplay [--shots dir] [--seed n] [--novsync]   (window) a bot plays ante 1 through the UI
local mode
for _, a in ipairs(arg) do
  if a == '--check' or a == '--parity' or a == '--savetest' or a == '--fonttest' or a == '--report' then mode = a end
end

local function headless(fn)
  function love.load()
    local ok, err = xpcall(fn, debug.traceback)
    if not ok then io.stderr:write(err, '\n'); print(err) end
    love.event.quit(ok and 0 or 1)
  end
end

if mode == '--check' then
  headless(function() local bad = require('tools.check'); if bad > 0 then error('syntax errors') end end)
elseif mode == '--parity' then
  local a
  for i, v in ipairs(arg) do if v == '--parity' then a = { arg[i + 1], arg[i + 2] } end end
  headless(function() require('tests.lua_replay').run(a[1], a[2]) end)
elseif mode == '--report' then
  -- prints which web content the Lua game has not ported yet (data.lua lists it as it loads); see tools/sync.mjs
  headless(function() require('src.data') end)
elseif mode == '--savetest' then
  headless(function() require('tests.save_test').run() end)
elseif mode == '--fonttest' then
  headless(function() require('tests.drawtest').run() end)
else
  require('src.app')
end
