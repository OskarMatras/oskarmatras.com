-- Small JSON encoder/decoder written for this project (no third-party code).
--
-- encode(v, opts)   Lua value -> string. Tables with keys 1..n and nothing else
--                   are arrays (an empty table is "[]"); other tables are
--                   objects with sorted keys, so output is deterministic.
--                   opts.null = sentinel value to write as null.
--                   An array element that is `false` is written as null when
--                   opts.false_as_null is set (used for the board).
-- decode(str)       string -> Lua value. null inside an array becomes false
--                   (the board uses false for "empty"); null as an object
--                   value is dropped.
local M = {}

local floor, format = math.floor, string.format

local function is_array(t)
  local n = 0
  for k in pairs(t) do
    if type(k) ~= 'number' or k < 1 or k ~= floor(k) then return false end
    if k > n then n = k end
  end
  for i = 1, n do if t[i] == nil then return false end end
  return true, n
end

local esc = { ['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b', ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }
local function enc_str(s)
  return '"' .. s:gsub('[%c"\\]', function(c) return esc[c] or format('\\u%04x', c:byte()) end) .. '"'
end

local function enc_num(n)
  if n ~= n or n == math.huge or n == -math.huge then return 'null' end
  if n == floor(n) and n > -1e15 and n < 1e15 then return format('%d', n) end
  return format('%.17g', n)
end

local function encode(v, opts, out)
  local tv = type(v)
  if tv == 'nil' then out[#out + 1] = 'null'
  elseif tv == 'boolean' then out[#out + 1] = v and 'true' or 'false'
  elseif tv == 'number' then out[#out + 1] = enc_num(v)
  elseif tv == 'string' then out[#out + 1] = enc_str(v)
  elseif tv == 'table' then
    if opts.null ~= nil and v == opts.null then out[#out + 1] = 'null'; return end
    local arr, n = is_array(v)
    if arr then
      out[#out + 1] = '['
      for i = 1, n do
        if i > 1 then out[#out + 1] = ',' end
        if v[i] == false and opts.false_as_null then out[#out + 1] = 'null' else encode(v[i], opts, out) end
      end
      out[#out + 1] = ']'
    else
      local keys = {}
      for k in pairs(v) do keys[#keys + 1] = tostring(k) end
      table.sort(keys)
      out[#out + 1] = '{'
      local first = true
      for _, k in ipairs(keys) do
        local val = v[k]
        if val == nil then val = v[tonumber(k)] end
        if val ~= nil then
          if not first then out[#out + 1] = ',' end
          first = false
          out[#out + 1] = enc_str(k) .. ':'
          encode(val, opts, out)
        end
      end
      out[#out + 1] = '}'
    end
  else
    error('cannot encode ' .. tv)
  end
end

function M.encode(v, opts)
  local out = {}
  encode(v, opts or {}, out)
  return table.concat(out)
end

local function skip(s, i) return s:find('[^ \t\r\n]', i) or #s + 1 end

local function utf8_char(cp)
  if cp < 0x80 then return string.char(cp)
  elseif cp < 0x800 then return string.char(0xC0 + floor(cp / 64), 0x80 + cp % 64)
  elseif cp < 0x10000 then return string.char(0xE0 + floor(cp / 4096), 0x80 + floor(cp / 64) % 64, 0x80 + cp % 64)
  end
  return string.char(0xF0 + floor(cp / 262144), 0x80 + floor(cp / 4096) % 64, 0x80 + floor(cp / 64) % 64, 0x80 + cp % 64)
end

local decode_value

local function dec_str(s, i)
  local out, j = {}, i + 1
  while true do
    local c = s:find('["\\]', j)
    if not c then error('unterminated string') end
    out[#out + 1] = s:sub(j, c - 1)
    if s:sub(c, c) == '"' then return table.concat(out), c + 1 end
    local e = s:sub(c + 1, c + 1)
    if e == 'u' then
      local cp = tonumber(s:sub(c + 2, c + 5), 16)
      j = c + 6
      if cp >= 0xD800 and cp < 0xDC00 and s:sub(j, j + 1) == '\\u' then
        local lo = tonumber(s:sub(j + 2, j + 5), 16)
        cp = 0x10000 + (cp - 0xD800) * 1024 + (lo - 0xDC00)
        j = j + 6
      end
      out[#out + 1] = utf8_char(cp)
    else
      local map = { b = '\b', f = '\f', n = '\n', r = '\r', t = '\t' }
      out[#out + 1] = map[e] or e
      j = c + 2
    end
  end
end

function decode_value(s, i)
  i = skip(s, i)
  local c = s:sub(i, i)
  if c == '{' then
    local obj = {}
    i = skip(s, i + 1)
    if s:sub(i, i) == '}' then return obj, i + 1 end
    while true do
      i = skip(s, i)
      local k; k, i = dec_str(s, i)
      i = skip(s, i)
      if s:sub(i, i) ~= ':' then error('expected : at ' .. i) end
      local v; v, i = decode_value(s, i + 1)
      if v ~= nil then obj[k] = v end
      i = skip(s, i)
      local d = s:sub(i, i)
      if d == '}' then return obj, i + 1 end
      if d ~= ',' then error('expected , or } at ' .. i) end
      i = i + 1
    end
  elseif c == '[' then
    local arr, n = {}, 0
    i = skip(s, i + 1)
    if s:sub(i, i) == ']' then return arr, i + 1 end
    while true do
      local v; v, i = decode_value(s, i)
      n = n + 1
      if v == nil then v = false end
      arr[n] = v
      i = skip(s, i)
      local d = s:sub(i, i)
      if d == ']' then return arr, i + 1 end
      if d ~= ',' then error('expected , or ] at ' .. i) end
      i = i + 1
    end
  elseif c == '"' then
    return dec_str(s, i)
  elseif s:sub(i, i + 3) == 'true' then return true, i + 4
  elseif s:sub(i, i + 4) == 'false' then return false, i + 5
  elseif s:sub(i, i + 3) == 'null' then return nil, i + 4
  end
  local num = s:match('^-?%d+%.?%d*[eE]?[+-]?%d*', i)
  if not num or num == '' then error('bad json at ' .. i) end
  return tonumber(num), i + #num
end

function M.decode(s)
  local v, i = decode_value(s, 1)
  i = skip(s, i)
  if i <= #s then error('trailing garbage at ' .. i) end
  return v
end

return M
