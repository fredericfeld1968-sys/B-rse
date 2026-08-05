param(
    [int]$Port = 8080
)

$root = $PSScriptRoot

$mimeTypes = @{
    ".html"         = "text/html; charset=utf-8"
    ".css"          = "text/css; charset=utf-8"
    ".js"           = "application/javascript; charset=utf-8"
    ".json"         = "application/json; charset=utf-8"
    ".png"          = "image/png"
    ".ico"          = "image/x-icon"
    ".svg"          = "image/svg+xml"
}

function Get-ContentType($path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    if ($mimeTypes.ContainsKey($ext)) { return $mimeTypes[$ext] }
    return "application/octet-stream"
}

function Read-Line([System.Net.Sockets.NetworkStream]$stream) {
    $bytes = New-Object System.Collections.Generic.List[byte]
    while ($true) {
        $b = $stream.ReadByte()
        if ($b -eq -1) { break }
        if ($b -eq 13) { continue }
        if ($b -eq 10) { break }
        $bytes.Add([byte]$b)
    }
    return [System.Text.Encoding]::ASCII.GetString($bytes.ToArray())
}

function Write-Response([System.Net.Sockets.NetworkStream]$stream, [int]$status, [string]$statusText, [string]$contentType, [byte[]]$bodyBytes, [bool]$sendBody = $true) {
    $header = "HTTP/1.1 $status $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($bodyBytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($sendBody -and $bodyBytes.Length -gt 0) {
        $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    }
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
$listener.Start()

Write-Output "Boerse-App Server laeuft:"
Write-Output "  http://localhost:$Port/"
try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -notmatch "^169\." -and $_.IPAddress -ne "127.0.0.1" }
    foreach ($ip in $ips) {
        Write-Output "  http://$($ip.IPAddress):$Port/  (im selben WLAN, z. B. vom Handy)"
    }
} catch {}
Write-Output "Zum Beenden: Strg+C"
Write-Output ""

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()

        $requestLine = Read-Line $stream
        if (-not $requestLine) { $client.Close(); continue }
        $parts = $requestLine.Split(" ")
        if ($parts.Length -lt 2) { $client.Close(); continue }
        $method = $parts[0]
        $path = $parts[1]

        $headers = @{}
        while ($true) {
            $line = Read-Line $stream
            if ($line -eq "") { break }
            $idx = $line.IndexOf(":")
            if ($idx -gt 0) {
                $headers[$line.Substring(0, $idx).Trim()] = $line.Substring($idx + 1).Trim()
            }
        }

        if ($method -eq "POST" -and $path -eq "/api/settings") {
            $len = 0
            if ($headers.ContainsKey("Content-Length")) { $len = [int]$headers["Content-Length"] }
            $buf = New-Object byte[] $len
            $total = 0
            while ($total -lt $len) {
                $n = $stream.Read($buf, $total, $len - $total)
                if ($n -le 0) { break }
                $total += $n
            }
            $bodyText = [System.Text.Encoding]::UTF8.GetString($buf)

            try {
                $null = $bodyText | ConvertFrom-Json
                $settingsPath = Join-Path $root "data\settings.json"
                [System.IO.File]::WriteAllText($settingsPath, $bodyText, [System.Text.Encoding]::UTF8)
                $respBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                Write-Response $stream 200 "OK" "application/json" $respBytes
            } catch {
                $respBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":false,"error":"invalid json"}')
                Write-Response $stream 400 "Bad Request" "application/json" $respBytes
            }
        }
        elseif ($method -eq "GET" -or $method -eq "HEAD") {
            $reqPath = $path.Split("?")[0]
            if ($reqPath -eq "/") { $reqPath = "/index.html" }
            $reqPath = $reqPath -replace "\.\.", ""
            $relative = ($reqPath.TrimStart("/") -replace "/", "\")
            $filePath = Join-Path $root $relative

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $contentType = Get-ContentType $filePath
                Write-Response $stream 200 "OK" $contentType $bytes ($method -eq "GET")
            } else {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $reqPath")
                Write-Response $stream 404 "Not Found" "text/plain; charset=utf-8" $bytes ($method -eq "GET")
            }
        }
        else {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("405 Method Not Allowed")
            Write-Response $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" $bytes
        }
    } catch {
        Write-Output "Fehler bei Anfrage: $_"
    } finally {
        $client.Close()
    }
}
