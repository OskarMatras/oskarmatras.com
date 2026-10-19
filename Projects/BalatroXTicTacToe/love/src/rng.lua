-- Seedable xorshift32. The JS test harness uses the identical generator in place
-- of Math.random, which is what lets the parity test compare whole games.
local bit = require('bit')
local M = {}
local x = 2463534242 % 4294967296
x = bit.tobit(x)

function M.seed(s)
  x = bit.tobit(math.floor(s))
  if x == 0 then x = 1 end
end

-- Float in [0, 1)
function M.random()
  x = bit.bxor(x, bit.lshift(x, 13))
  x = bit.bxor(x, bit.rshift(x, 17))
  x = bit.bxor(x, bit.lshift(x, 5))
  return (x % 4294967296) / 4294967296
end

return M
