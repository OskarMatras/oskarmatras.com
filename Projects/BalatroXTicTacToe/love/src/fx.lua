-- Short-lived visual state: floating score pops, toasts, the banner, screen
-- shake, per-element bounce timers. The engine reaches it through the `ui`
-- hook table in app.lua; the view reads it every frame.
local state = require('src.state')
local S, SET = state.S, state.SET

local M = {}
M.t = 0
M.pops, M.toasts = {}, {}
M.banner = nil
M.shakeAmp, M.shakeT = 0, 99
M.calc = { chips = 0, mult = 0, label = nil, total = nil }
M.bump = { chips = -9, mult = -9 }
M.scoreOverride = nil
M.cellAnim = {}      -- [cell] = start time of the pop-in
M.cellFlag = {}      -- [cell] = { scoring = true, held = true }
M.jig = {}           -- [key] = start time
M.dealt = setmetatable({}, { __mode = 'k' })  -- [piece table] = start time
M.layout = { cells = {}, jokers = {}, items = {}, board = nil }  -- rects filled in by the view each frame

local function speed() return math.max(1, SET.speed * 0.7) end

function M.reset()
  M.pops, M.toasts, M.banner = {}, {}, nil
  M.calc = { chips = 0, mult = 0, label = nil, total = nil }
  M.scoreOverride = nil
  M.cellFlag = {}
end

-- Rect of a target descriptor made by the engine hooks.
function M.rectOf(target)
  if not target then return nil end
  local L = M.layout
  if target.kind == 'cell' then return L.cells[target.i]
  elseif target.kind == 'joker' then return L.jokers[target.uid]
  elseif target.kind == 'board' then return L.board end
end

function M.pop(target, text, cls)
  local r = M.rectOf(target)
  if not r then return end
  M.pops[#M.pops + 1] = {
    x = r.x + r.w / 2, y = r.y + r.h * 0.3, text = text, cls = cls, t0 = M.t,
    dur = 0.8 / speed(), rot = (math.random() - 0.5) * 0.28,
  }
end

function M.toast(msg) M.toasts[#M.toasts + 1] = { text = msg, t0 = M.t }; if #M.toasts > 1 then table.remove(M.toasts, 1) end end

function M.showBanner(text, bad)
  M.banner = { text = text, bad = bad, t0 = M.t }
  return { remove = function() M.banner = nil end }
end

function M.shake(power)
  M.shakeAmp = 2 + 9 * math.min(1, math.max(0, power))
  M.shakeT = 0
end
function M.shakeOffset()
  if M.shakeT > 0.38 then return 0, 0, 0 end
  local p = M.shakeT / 0.38
  local k = (1 - p) * (1 - p)
  local a = M.shakeAmp
  return math.sin(p * 18) * a * k * 0.9, math.cos(p * 15) * a * k * 0.6, math.sin(p * 14) * a * k * 0.0016
end

function M.update(dt)
  M.t = M.t + dt
  M.shakeT = M.shakeT + dt
  for i = #M.pops, 1, -1 do if M.t - M.pops[i].t0 > M.pops[i].dur then table.remove(M.pops, i) end end
  for i = #M.toasts, 1, -1 do if M.t - M.toasts[i].t0 > 2.0 then table.remove(M.toasts, i) end end
end

-- Easing helpers ---------------------------------------------------------------
function M.easeOutBack(x, s)
  s = s or 1.7
  x = math.min(1, math.max(0, x))
  local c3 = s + 1
  return 1 + c3 * (x - 1) ^ 3 + s * (x - 1) ^ 2
end
function M.clamp01(x) return math.min(1, math.max(0, x)) end

return M
