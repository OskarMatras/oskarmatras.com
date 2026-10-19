# Builds dist/bxt.love (a zip LÖVE can run: `love dist/bxt.love`). Tests and tools stay out.
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $out | Out-Null
$zip = Join-Path $out 'bxt.zip'
$love = Join-Path $out 'bxt.love'
Remove-Item $zip, $love -ErrorAction SilentlyContinue
$items = @('main.lua', 'conf.lua', 'src', 'lib', 'assets', 'THIRD_PARTY.md') | ForEach-Object { Join-Path $root $_ }
Compress-Archive -Path $items -DestinationPath $zip
Rename-Item $zip 'bxt.love'
Write-Host "built $love"
