-- Headless modes (tests) run without a window, graphics or audio.
local headless, dev = false, false
for _, a in ipairs(arg or {}) do
  if a == '--parity' or a == '--check' or a == '--savetest' or a == '--report' then headless = true end
  if a == '--autoplay' or a == '--bench' then dev = true end
end

function love.conf(t)
  -- developer runs use their own save folder so they never touch a real save
  t.identity = dev and 'bxt-love-dev' or 'bxt-love'
  t.version = '11.5'
  t.console = false
  if headless then
    t.window = nil
    t.modules.window = false
    t.modules.graphics = false
    t.modules.audio = false
    t.modules.sound = false
    t.modules.joystick = false
    t.modules.touch = false
    t.modules.video = false
    return
  end
  t.window.title = 'Balatro X TicTacToe'
  t.window.width = 1024
  t.window.height = 768
  t.window.minwidth = 640
  t.window.minheight = 480
  t.window.resizable = true
  t.window.vsync = 1
  t.window.msaa = 0
  t.modules.physics = false
  t.modules.video = false
end
