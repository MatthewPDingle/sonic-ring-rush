param([switch]$ServeOnly, [int]$Port = 5188)
$ErrorActionPreference = 'Stop'
$gameRoot = Join-Path $PSScriptRoot 'game'
if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'index.html'))) { $gameRoot = Join-Path $PSScriptRoot 'dist' }
if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'index.html'))) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('The game files are missing. Extract the entire ZIP before starting Sonic Ring Rush.', 'Sonic Ring Rush') | Out-Null
    exit 1
}
$gameRoot = [System.IO.Path]::GetFullPath($gameRoot)
if (-not $ServeOnly) {
    # Reuse our own server or choose a free loopback port. Never expose it to the network.
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/__ping" -UseBasicParsing -TimeoutSec 1
            if ($health.Content -eq 'SONIC_RING_RUSH_1') { $ready = $true; break }
            $Port++
        } catch {
            $probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
            try { $probe.Start(); $probe.Stop(); break } catch { $Port++ }
        }
    }
    if (-not $ready) {
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -ServeOnly -Port ' + $Port
        Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden | Out-Null
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            Start-Sleep -Milliseconds 150
            try { $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/__ping" -UseBasicParsing -TimeoutSec 1; if ($health.Content -eq 'SONIC_RING_RUSH_1') { $ready = $true; break } } catch { }
        }
    }
    if ($ready) { Start-Process "http://127.0.0.1:$Port/" }
    else {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show('The local game server could not start. Please try opening Start-Game.cmd again.', 'Sonic Ring Rush') | Out-Null
    }
    exit
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
$lastRequest = [DateTime]::UtcNow
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.png'='image/png'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.json'='application/json' }
try {
    while (([DateTime]::UtcNow - $lastRequest).TotalSeconds -lt 300) {
        if (-not $listener.Pending()) { Start-Sleep -Milliseconds 50; continue }
        $client = $listener.AcceptTcpClient()
        $client.ReceiveTimeout = 3000; $client.SendTimeout = 3000
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $firstLine = $reader.ReadLine()
            if (-not $firstLine) { continue }
            $parts = $firstLine.Split(' ')
            if ($parts.Count -lt 2) { continue }
            while ($reader.ReadLine()) { }
            $lastRequest = [DateTime]::UtcNow
            $urlPath = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
            $status = '200 OK'; $contentType = 'text/plain; charset=utf-8'
            if ($urlPath -eq '/__ping') { $bytes = [Text.Encoding]::UTF8.GetBytes('SONIC_RING_RUSH_1') }
            elseif ($parts[0] -notin @('GET', 'HEAD')) { $status = '405 Method Not Allowed'; $bytes = [Text.Encoding]::UTF8.GetBytes('Method not allowed') }
            else {
                if ($urlPath -eq '/') { $urlPath = '/index.html' }
                $relative = $urlPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
                $file = [IO.Path]::GetFullPath((Join-Path $gameRoot $relative))
                if (-not $file.StartsWith($gameRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or $relative.Contains(':') -or -not [IO.File]::Exists($file)) {
                    $status = '404 Not Found'; $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
                } else {
                    $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
                    $contentType = $mime[$extension]
                    if (-not $contentType) { $contentType = 'application/octet-stream' }
                    if ($extension -eq '.html') {
                        $html = [IO.File]::ReadAllText($file)
                        $keepAlive = '<script>setInterval(()=>fetch("/__ping").catch(()=>{}),30000);</script>'
                        $bytes = [Text.Encoding]::UTF8.GetBytes($html.Replace('</body>', $keepAlive + '</body>'))
                    } else { $bytes = [IO.File]::ReadAllBytes($file) }
                }
            }
            $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            if ($parts[0] -ne 'HEAD') { $stream.Write($bytes, 0, $bytes.Length) }
            $stream.Flush()
        } catch { } finally { $client.Close() }
    }
} finally { $listener.Stop() }
