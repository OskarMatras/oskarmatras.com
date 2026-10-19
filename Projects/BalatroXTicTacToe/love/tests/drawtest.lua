local gfx = require('src.gfx')
local M = {}
function M.run()
  gfx.resize(love.graphics.getDimensions())
  for _, n in ipairs({'ui','num','pix'}) do
    local F = gfx.font(n, 24)
    print(n, F.f:getHeight(), F.k, F.f:getWidth('Small Blind'))
  end
  local c = love.graphics.newCanvas(1024, 768)
  love.graphics.setCanvas(c)
  love.graphics.clear(0.1,0.2,0.2,1)
  gfx.begin()
  gfx.print('num', 20, 'Small Blind', 20, 20)
  gfx.print('ui', 20, 'Small Blind ui', 20, 60)
  gfx.print('pix', 20, 'Small Blind pix', 20, 100)
  gfx.print('num', 28, '12,345 x 678', 20, 140)
  gfx.finish()
  love.graphics.setCanvas()
  local img = c:newImageData()
  local fd = img:encode('png')
  local f = io.open('tests/out/drawtest.png','wb'); f:write(fd:getString()); f:close()
end
return M
