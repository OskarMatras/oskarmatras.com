for _, p in ipairs({'assets/fonts/Rubik.ttf','assets/fonts/LilitaOne-Regular.ttf','assets/fonts/Silkscreen-Regular.ttf'}) do
  local ok, f = pcall(love.graphics.newFont, p, 20)
  print(p, ok, ok and f:getHeight() or f)
end
