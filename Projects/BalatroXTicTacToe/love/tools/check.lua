-- Syntax-check every Lua file: lovec . --check
local function walk(dir, out)
  for _, name in ipairs(love.filesystem.getDirectoryItems(dir)) do
    local p = dir == '' and name or (dir .. '/' .. name)
    local info = love.filesystem.getInfo(p)
    if info.type == 'directory' then
      if name ~= '.git' and name ~= 'out' then walk(p, out) end
    elseif p:match('%.lua$') then out[#out + 1] = p end
  end
end
local files, bad = {}, 0
walk('', files)
for _, f in ipairs(files) do
  local fn, err = love.filesystem.load(f)
  if not fn then bad = bad + 1; print('SYNTAX', err) end
end
print(('checked %d files, %d with errors'):format(#files, bad))
return bad
