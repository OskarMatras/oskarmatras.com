-- LÖVE callbacks: window, frame loop, input, and the hooks through which the
-- engine drives the interface.
local state = require('src.state')
local rng = require('src.rng')
local rules = require('src.rules')
local strings = require('src.strings')
local audio = require('src.audio')
local engine = require('src.engine')
local gfx = require('src.gfx')
local fx = require('src.fx')
local cards = require('src.cards')
local shaders = require('src.shaders')
local W = require('src.widgets')
local V = require('src.view')

local S, SET = state.S, state.SET
local ui = engine.ui

-- CLI flags (developer tools) ----------------------------------------------------
local flags = {}
for i, a in ipairs(arg or {}) do
  if a == '--autoplay' then flags.autoplay = true
  elseif a == '--bench' then flags.bench = true
  elseif a == '--shots' then flags.shots = arg[i + 1]
  elseif a == '--seed' then flags.seed = tonumber(arg[i + 1])
  elseif a == '--size' then flags.w, flags.h = tostring(arg[i + 1]):match('^(%d+)x(%d+)$')
  elseif a == '--novsync' then flags.novsync = true
  elseif a == '--sound' then flags.sound = true end
end

local bgCanvas, screenCanvas
local function makeCanvases()
  local w, h = love.graphics.getDimensions()
  bgCanvas = love.graphics.newCanvas(math.max(1, math.floor(w / 4)), math.max(1, math.floor(h / 4)))
  bgCanvas:setFilter('nearest', 'nearest')
  screenCanvas = love.graphics.newCanvas(w, h)
end

-- Engine -> interface hooks ----------------------------------------------------------
ui.render = function()
  fx.calc = { chips = 0, mult = 0, label = nil, total = nil }
  fx.scoreOverride = nil
  fx.banner = nil
  fx.cellFlag = {}
  for i, c in ipairs(S.board or {}) do
    if c and c.fresh then fx.cellAnim[i] = fx.t; c.fresh = false end
  end
  for k, v in pairs(fx.cellAnim) do if fx.t - v > 1 then fx.cellAnim[k] = nil end end
  for _, p in ipairs(S.hand or {}) do
    if p.dealt then fx.dealt[p] = fx.t; p.dealt = false end
  end
end
ui.toast = function(msg) fx.toast(msg) end
ui.pop = function(target, text, cls) fx.pop(target, text, cls) end
ui.jig = function(target) if target and target.kind == 'joker' then fx.jig['j' .. target.uid] = fx.t end end
ui.cellEl = function(i) return { kind = 'cell', i = i } end
ui.jokerEl = function(uid) return { kind = 'joker', uid = uid } end
ui.boardEl = function() return { kind = 'board' } end
ui.setCalc = function(chips, mult, label)
  fx.calc.chips, fx.calc.mult = chips, mult
  if label ~= nil then fx.calc.label = label ~= '' and label or nil; fx.calc.total = nil end
end
ui.bumpCalc = function(which) fx.bump[which] = fx.t end
ui.showTotal = function(total) fx.calc.total = total end
ui.setRoundScore = function(v) fx.scoreOverride = v end
ui.markCells = function(cells, cls, on)
  for _, i in ipairs(cells) do
    local f = fx.cellFlag[i]
    if not f then f = {}; fx.cellFlag[i] = f end
    f[cls] = on or nil
  end
end
ui.banner = function(msg, bad) return fx.showBanner(msg, bad) end
ui.shake = function(power) fx.shake(power) end
ui.showModal = function(kind) V.showModal(kind) end

-- Settings -------------------------------------------------------------------------------
local function applyLang()
  strings.setLang(SET.lang or 'en')
end
V.hooks.toggleLang = function()
  SET.lang = strings.getLang() == 'en' and 'da' or 'en'
  applyLang(); state.saveSettings()
  cards.clear()
end
V.hooks.toggleFullscreen = function()
  love.window.setFullscreen(not love.window.getFullscreen(), 'desktop')
  SET.fullscreen = love.window.getFullscreen()
  state.saveSettings()
end

-- UI size: Small / Medium / Large (how much of the window the layout may fill, see gfx.resize).
local function applyUiSize()
  gfx.zoom = gfx.ZOOMS[SET.uiSize or 2] or gfx.zoom
  gfx.resize(love.graphics.getDimensions())
  cards.clear()
end
V.hooks.cycleUiSize = function()
  SET.uiSize = ((SET.uiSize or 2) % 3) + 1
  state.saveSettings()
  applyUiSize()
end

local autoplay

function love.load()
  love.graphics.setDefaultFilter('linear', 'linear')
  love.keyboard.setKeyRepeat(false)
  state.use_love_filesystem()
  state.loadSettings()
  if (flags.autoplay or flags.bench) then SET.sound = flags.sound == true end
  if flags.shots or flags.autoplay or flags.bench then SET.speed = 4 end
  applyLang()
  if flags.novsync then love.window.setVSync(0) end
  if flags.w then
    love.window.updateMode(tonumber(flags.w), tonumber(flags.h), { resizable = true })   -- developer: --size 1920x1080
  elseif not flags.autoplay and not flags.bench and not SET.fullscreen then
    -- Open at a size that suits this screen: most of the desktop, never smaller than the base layout.
    local dw, dh = love.window.getDesktopDimensions()
    local w, h = math.max(1024, math.floor(dw * 0.86)), math.max(768, math.floor(dh * 0.86))
    if dw >= 1024 and dh >= 768 then
      love.window.updateMode(math.min(w, dw), math.min(h, dh), { resizable = true })
      love.window.setPosition(math.floor((dw - math.min(w, dw)) / 2), math.floor((dh - math.min(h, dh)) / 2))
    end
  end
  if SET.fullscreen and not (flags.autoplay or flags.bench) then love.window.setFullscreen(true, 'desktop') end
  rng.seed(flags.seed or (os.time() * 1000 + math.floor((love.timer.getTime() * 1e6) % 1000)))
  math.randomseed(os.time())
  rules.freshRun(); S.phase = 'title'
  engine.async = true
  gfx.zoom = gfx.ZOOMS[SET.uiSize or 2] or gfx.zoom
  gfx.resize(love.graphics.getDimensions())
  makeCanvases()
  if flags.autoplay or flags.bench then
    autoplay = require('src.autoplay')
    autoplay.start(flags)
  end
end

function love.resize(w, h)
  gfx.resize(w, h)
  cards.clear()
  makeCanvases()
end

local function pointer()
  local mx, my = love.mouse.getPosition()
  local vx, vy = gfx.toVirtual(mx, my)
  if W.mouseOverride then vx, vy = W.mouseOverride.x, W.mouseOverride.y end
  W.mouse.x, W.mouse.y = vx, vy
  cards.pointer.x, cards.pointer.y = vx, vy
  cards.pointer.active = love.window.hasMouseFocus()
end

function love.update(dt)
  local t0 = autoplay and love.timer.getTime()
  dt = math.min(dt, 0.1)
  pointer()
  fx.update(dt)
  cards.update(dt, fx.t)
  engine.update(dt)
  audio.update(dt)
  if autoplay then
    autoplay.update(dt)
    autoplay.afterUpdate(love.timer.getTime() - t0)
  end
end

local function drawBackground()
  local w, h = love.graphics.getDimensions()
  local bg = shaders.background()
  love.graphics.setCanvas(screenCanvas)
  love.graphics.clear(0.05, 0.1, 0.1, 1)
  -- render the felt at quarter resolution, then scale up without smoothing
  love.graphics.setCanvas(bgCanvas)
  bg:send('T', fx.t)
  bg:send('R', { bgCanvas:getWidth(), bgCanvas:getHeight() })
  love.graphics.setShader(bg)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.rectangle('fill', 0, 0, bgCanvas:getWidth(), bgCanvas:getHeight())
  love.graphics.setShader()
  love.graphics.setCanvas(screenCanvas)
  love.graphics.draw(bgCanvas, 0, 0, 0, w / bgCanvas:getWidth(), h / bgCanvas:getHeight())
end

local drawTime, updateTime = 0, 0
function love.draw()
  local t0 = love.timer.getTime()
  drawBackground()
  W.beginFrame()
  gfx.begin()
  V.draw()
  gfx.finish()
  love.graphics.setCanvas()
  love.graphics.setColor(1, 1, 1, 1)
  if SET.crt then
    local sh = shaders.crt()
    local w, h = love.graphics.getDimensions()
    sh:send('T', fx.t)
    sh:send('R', { w, h })
    love.graphics.setShader(sh)
    love.graphics.draw(screenCanvas)
    love.graphics.setShader()
  else
    love.graphics.draw(screenCanvas)
  end
  drawTime = love.timer.getTime() - t0
  if autoplay then autoplay.afterDraw(drawTime) end
end

-- Input ------------------------------------------------------------------------------------
function love.mousepressed(x, y, button)
  if button ~= 1 then return end
  pointer()
  W.mousepressed()
end
function love.mousereleased(x, y, button)
  if button ~= 1 then return end
  pointer()
  if not W.mousereleased() then V.onClickOutside() end
end
function love.wheelmoved(dx, dy)
  V.scroll = 0   -- nothing in the game scrolls
end

function love.keypressed(key)
  local act = engine.actions
  if key == 'f11' or (key == 'return' and love.keyboard.isDown('lalt', 'ralt')) then V.hooks.toggleFullscreen(); return end
  if key == 'escape' then
    if V.insp then V.insp = nil
    elseif V.modal then V.showModal(nil)
    elseif S.mode then act.cancelMode()
    elseif S.phase ~= 'title' and S.phase ~= 'over' and S.phase ~= 'cashout' and S.phase ~= 'won' and not S.pack then V.showModal('info') end
    return
  end
  if V.modal then return end
  if S.phase == 'play' and not S.busy then
    if S.N == 3 and key:match('^[1-9]$') then act.cell(tonumber(key)); return end
    if key == 'left' and #S.hand > 0 then act.selectPiece(((S.selIdx - 2) % #S.hand) + 1); return end
    if key == 'right' and #S.hand > 0 then act.selectPiece((S.selIdx % #S.hand) + 1); return end
    if key == 'd' then act.discard(); return end
  end
  if key == 'return' or key == 'kpenter' then
    if S.phase == 'title' then if state.hasSavedRun() then act.continueRun() else act.newRun() end
    elseif S.phase == 'over' then act.newRun()
    elseif S.phase == 'blind' then act.startBlind()
    elseif S.phase == 'cashout' then act.cashOut()
    elseif S.phase == 'shop' and not S.pack and not S.mode then act.nextRound() end
  end
end

function love.quit()
  state.saveRun()
  state.saveSettings()
end
