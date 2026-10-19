-- Board geometry for an N×N grid where three in a row always wins.
-- Lines are every run of three cells horizontally, vertically or along either
-- diagonal, so a 4×4 board has 24 lines and a 5×5 board 48. Cell and line
-- indices are 1-based; rc() still returns 0-based row/col (as the JS does) so
-- square-upgrade keys ("row,col") match the web version.
local state = require('src.state')
local S = state.S

local M = {}
local cache = {}

function M.geo()
  local N = S.N
  if cache[N] then return cache[N] end
  local lines = {}
  local dirs = { { 0, 1, 'row' }, { 1, 0, 'col' }, { 1, 1, 'diag' }, { 1, -1, 'diag' } }
  for r = 0, N - 1 do for c = 0, N - 1 do
    for _, d in ipairs(dirs) do
      local dr, dc, ty = d[1], d[2], d[3]
      local r2, c2 = r + 2 * dr, c + 2 * dc
      if not (r2 < 0 or r2 >= N or c2 < 0 or c2 >= N) then
        lines[#lines + 1] = { cells = { r * N + c + 1, (r + dr) * N + c + dc + 1, r2 * N + c2 + 1 }, type = ty, dr = dr, dc = dc }
      end
    end
  end end
  local through = {}
  for i = 1, N * N do through[i] = 0 end
  for _, l in ipairs(lines) do for _, i in ipairs(l.cells) do through[i] = through[i] + 1 end end
  cache[N] = { N = N, lines = lines, through = through }
  return cache[N]
end

function M.rc(i) local i0 = i - 1; return math.floor(i0 / S.N), i0 % S.N end

function M.isCorner(i)
  local r, c = M.rc(i); local m = S.N - 1
  return (r == 0 or r == m) and (c == 0 or c == m)
end
function M.isEdge(i)
  local r, c = M.rc(i); local m = S.N - 1
  return (r == 0 or r == m or c == 0 or c == m) and not M.isCorner(i)
end
-- Odd boards have one center square, even boards the middle four.
function M.isCenter(i)
  local r, c = M.rc(i); local N = S.N
  if N % 2 == 1 then return r == (N - 1) / 2 and c == (N - 1) / 2 end
  return (r == N / 2 or r == N / 2 - 1) and (c == N / 2 or c == N / 2 - 1)
end
function M.squareKey(i) local r, c = M.rc(i); return r .. ',' .. c end
function M.squareOf(i) return S.squares[M.squareKey(i)] or {} end
function M.neighbours(i)
  local r, c = M.rc(i); local out = {}
  for dr = -1, 1 do for dc = -1, 1 do
    local r2, c2 = r + dr, c + dc
    if (dr ~= 0 or dc ~= 0) and r2 >= 0 and c2 >= 0 and r2 < S.N and c2 < S.N then out[#out + 1] = r2 * S.N + c2 + 1 end
  end end
  return out
end

-- How many X's in an unbroken run this line belongs to (3, 4 or 5), by
-- walking outward from both ends in the line's own direction.
function M.runLength(l)
  local function isX(r, c)
    if r < 0 or c < 0 or r >= S.N or c >= S.N then return false end
    local cell = S.board[r * S.N + c + 1]
    return cell and cell.t == 'X' or false
  end
  local n = 3
  local r, c = M.rc(l.cells[1])
  while isX(r - l.dr, c - l.dc) do n = n + 1; r = r - l.dr; c = c - l.dc end
  r, c = M.rc(l.cells[3])
  while isX(r + l.dr, c + l.dc) do n = n + 1; r = r + l.dr; c = c + l.dc end
  return n
end

-- The square opposite this one through the board's centre.
function M.mirrorOf(i) return S.N * S.N + 1 - i end

return M
