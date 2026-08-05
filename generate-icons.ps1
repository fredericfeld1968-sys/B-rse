Add-Type -AssemblyName System.Drawing

function New-Icon($size, $path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $bg = [System.Drawing.ColorTranslator]::FromHtml("#0f1420")
    $accent = [System.Drawing.ColorTranslator]::FromHtml("#6c8dff")
    $green = [System.Drawing.ColorTranslator]::FromHtml("#34d399")

    $g.Clear($bg)

    $margin = [int]($size * 0.16)
    $rect = New-Object System.Drawing.Rectangle($margin, $margin, ($size - 2*$margin), ($size - 2*$margin))
    $pen = New-Object System.Drawing.Pen($accent, [int]($size * 0.045))
    $g.DrawRectangle($pen, $rect)

    $font = New-Object System.Drawing.Font("Segoe UI", [int]($size * 0.42), [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush($green)
    $text = "B"
    $sizeF = $g.MeasureString($text, $font)
    $x = ($size - $sizeF.Width) / 2
    $y = ($size - $sizeF.Height) / 2
    $g.DrawString($text, $font, $brush, $x, $y)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

New-Icon 192 "icons/icon-192.png"
New-Icon 512 "icons/icon-512.png"
Write-Output "Icons erstellt."
