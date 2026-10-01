$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$releaseRoot = Join-Path $workspace 'release'
$packageRoot = Join-Path $releaseRoot 'Sonic Ring Rush'
$sourceRoot = Join-Path $workspace 'dist'
if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'index.html'))) { throw 'Run npm run build before packaging.' }
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
if (Test-Path -LiteralPath $packageRoot) {
    $verified = [IO.Path]::GetFullPath($packageRoot)
    if (-not $verified.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package directory is outside workspace.' }
    Remove-Item -LiteralPath $verified -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'game') -Force | Out-Null
Copy-Item -Path (Join-Path $sourceRoot '*') -Destination (Join-Path $packageRoot 'game') -Recurse
foreach ($name in @('Start-Game.cmd','Start-Game.ps1','PLAY-ME.txt')) { Copy-Item -LiteralPath (Join-Path $workspace $name) -Destination $packageRoot }
Copy-Item -LiteralPath (Join-Path $workspace 'node_modules/three/LICENSE') -Destination (Join-Path $packageRoot 'THREE-LICENSE.txt')
$zip = Join-Path $releaseRoot 'Sonic-Ring-Rush-Windows.zip'
Compress-Archive -LiteralPath $packageRoot -DestinationPath $zip -Force
Get-Item -LiteralPath $zip | Select-Object FullName, Length
