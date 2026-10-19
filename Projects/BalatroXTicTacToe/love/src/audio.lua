-- Synthesised sound effects. Every sound is generated into a SoundData at
-- first use (square / triangle / sawtooth tones with an exponential pitch
-- slide and an exponential fade), so the game ships no audio files. Same
-- recipe and numbers as the web version's Web Audio oscillators.
local state = require('src.state')

local M = {}
M.enabled = true -- headless tests switch this off
local GAIN = 2.4  -- WebAudio gains are small; this brings them to a comfortable level
local SR = 44100

local cache, pending, active = {}, {}, {}

local function synth(f, d, wave, v, slide)
  local n = math.floor((d + 0.02) * SR)
  local sd = love.sound.newSoundData(n, SR, 16, 1)
  local phase = 0
  for i = 0, n - 1 do
    local tt = i / SR
    local fr = f
    if slide ~= 0 then fr = f * slide ^ (math.min(tt, d) / d) end
    phase = phase + fr / SR
    local ph = phase % 1
    local s
    if wave == 'square' then s = ph < 0.5 and 1 or -1
    elseif wave == 'triangle' then s = 4 * math.abs(ph - 0.5) - 1
    elseif wave == 'sawtooth' then s = 2 * ph - 1
    else s = math.sin(ph * 2 * math.pi) end
    local g = 0
    if tt <= d then g = v * (0.0001 / v) ^ (tt / d) end
    sd:setSample(i, s * g * GAIN)
  end
  return sd
end

local function tone(f, d, wave, v, slide)
  if not M.enabled or not state.SET.sound then return end
  d, wave, v, slide = d or 0.08, wave or 'square', v or 0.04, slide or 0
  local key = string.format('%.1f|%.3f|%s|%.3f|%.3f', f, d, wave, v, slide)
  local sd = cache[key]
  if not sd then sd = synth(f, d, wave, v, slide); cache[key] = sd end
  local src = love.audio.newSource(sd, 'static')
  src:play()
  active[#active + 1] = src
  -- drop finished sources so the list does not grow forever
  for i = #active, 1, -1 do if not active[i]:isPlaying() then table.remove(active, i) end end
end

local function later(ms, fn) pending[#pending + 1] = { t = ms / 1000, fn = fn } end

function M.update(dt)
  for i = #pending, 1, -1 do
    local p = pending[i]
    p.t = p.t - dt
    if p.t <= 0 then table.remove(pending, i); p.fn() end
  end
end

-- Pitch climbs while a score is being counted, then resets.
local step = 0
function M.resetStep() step = 0 end

M.sfx = {
  click = function() tone(660, .04, 'square', .025) end,
  place = function() tone(330, .09, 'triangle', .08, 1.6) end,
  o = function() tone(180, .12, 'sawtooth', .03, .7) end,
  chips = function() tone(480 + math.min(step, 30) * 35, .06, 'square', .03); step = step + 1 end,
  mult = function() tone(720 + math.min(step, 30) * 30, .08, 'triangle', .06); step = step + 1 end,
  xmult = function() tone(300, .15, 'sawtooth', .05, 2.5) end,
  score = function()
    tone(523, .12, 'triangle', .07)
    later(70, function() tone(659, .12, 'triangle', .07) end)
    later(140, function() tone(784, .2, 'triangle', .07) end)
  end,
  money = function() tone(1200, .05, 'square', .03); later(50, function() tone(1600, .08, 'square', .03) end) end,
  bad = function() tone(160, .35, 'sawtooth', .06, .5) end,
  win = function()
    for i, f in ipairs({ 523, 659, 784, 1046 }) do later((i - 1) * 90, function() tone(f, .18, 'triangle', .07) end) end
  end,
  line = function() tone(440, .1, 'triangle', .06, 1.5) end,
  boom = function() tone(90, .3, 'sawtooth', .08, .4) end,
}
M.resetStep = M.resetStep

return M
