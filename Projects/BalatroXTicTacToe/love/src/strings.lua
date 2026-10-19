-- Interface text in Danish and English. Dictionaries are generated from the
-- web game's strings.js (tools/gen_content.js). Content text elsewhere is
-- stored as {en=, da=} pairs and goes through tr().
local gen = require('src.strings_gen')
local state = require('src.state')

-- Interface text the Lua port adds on its own (shop sections, UI size). Anything the generated
-- dictionaries also define wins, so regenerating never loses a key.
local extra = {
  EN = {
    ['shop.cards'] = 'Cards', ['shop.cardsHint'] = 'Fresh picks each visit. Reroll for new ones.',
    ['shop.voucher'] = 'Voucher', ['shop.voucherHint'] = 'One per ante.',
    ['shop.packs'] = 'Packs', ['shop.packsHint'] = 'Open one, then choose from what is inside.',
    ['ui.uiSize'] = 'UI: {n}', ['ui.size1'] = 'Small', ['ui.size2'] = 'Medium', ['ui.size3'] = 'Large',
  },
  DA = {
    ['shop.cards'] = 'Kort', ['shop.cardsHint'] = 'Nye valg hver gang. Køb nye med Nye varer.',
    ['shop.voucher'] = 'Voucher', ['shop.voucherHint'] = 'Én pr. ante.',
    ['shop.packs'] = 'Pakker', ['shop.packsHint'] = 'Åbn en, og vælg så blandt indholdet.',
    ['ui.uiSize'] = 'UI: {n}', ['ui.size1'] = 'Lille', ['ui.size2'] = 'Mellem', ['ui.size3'] = 'Stor',
  },
}
local M = {}
local lang = 'en'
function M.getLang() return lang end
function M.setLang(l) if l == 'da' or l == 'en' then lang = l end end

function M.t(key, vars)
  local s = (lang == 'da' and (gen.DA[key] or extra.DA[key])) or gen.EN[key] or extra.EN[key] or key
  if vars then
    s = s:gsub('{(%w+)}', function(k)
      local v = vars[k]
      if v ~= nil then return tostring(v) end
    end)
  end
  return s
end

function M.tr(o)
  if o == nil then return '' end
  if type(o) == 'string' then return o end
  return o[lang] or o.en
end

local function group(n, sep)
  local s = string.format('%d', n)
  local out = s:reverse():gsub('(%d%d%d)', '%1' .. sep:reverse()):reverse()
  if out:sub(1, #sep) == sep then out = out:sub(#sep + 1) end
  return out
end

-- Whole numbers with the locale's grouping (1,234 in English, 1.234 in Danish).
function M.fmt(n)
  n = math.floor(n)
  if n >= 1e11 then return (string.format('%.2e', n):gsub('%+', ''):gsub('e0*(%d)', 'e%1')) end
  return group(n, lang == 'da' and '.' or ',')
end

-- Mult can be fractional after X multipliers.
function M.fmtM(m)
  if m == math.floor(m) or m >= 1000 then return M.fmt(m) end
  local s = string.format('%.14g', math.floor(m * 100 + 0.5) / 100)
  if lang == 'da' then s = s:gsub('%.', ',') end
  return s
end

return M
