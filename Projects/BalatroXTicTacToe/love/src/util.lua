-- Small helpers that mirror the JS idioms the game code relies on.
local M = {}

-- JS Math.round: halves round up.
function M.round(x) return math.floor(x + 0.5) end

-- JS truthiness of a number (0 is falsy).
function M.nz(x) return x ~= nil and x ~= 0 end

function M.includes(list, v)
  for i = 1, #list do if list[i] == v then return true end end
  return false
end

function M.find_index(list, pred)
  for i = 1, #list do if pred(list[i]) then return i end end
  return nil
end

function M.filter(list, pred)
  local out = {}
  for i = 1, #list do if pred(list[i]) then out[#out + 1] = list[i] end end
  return out
end

function M.map(list, fn)
  local out = {}
  for i = 1, #list do out[i] = fn(list[i], i) end
  return out
end

function M.push_all(dst, src) for i = 1, #src do dst[#dst + 1] = src[i] end end

-- JS Number.prototype.toFixed(d) for non-negative finite x: exact decimal
-- expansion, ties round up. (C printf rounds ties to even, which differs on
-- values such as 5.0625.toFixed(3).)
function M.toFixed(x, d)
  local s = string.format('%.30f', x)
  local ip, fp = s:match('^(%d+)%.(%d+)$')
  local keep = fp:sub(1, d)
  local nxt = tonumber(fp:sub(d + 1, d + 1)) or 0
  local digits = ip .. keep
  if nxt >= 5 then
    -- add one unit in the last place of `digits`
    local t, carry = {}, 1
    for i = #digits, 1, -1 do
      local v = tonumber(digits:sub(i, i)) + carry
      if v == 10 then t[i] = '0'; carry = 1 else t[i] = tostring(v); carry = 0 end
    end
    digits = (carry == 1 and '1' or '') .. table.concat(t)
  end
  local n = tonumber(digits)
  return n / 10 ^ d
end

return M
