Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $root 'assets/ios-launch-screen.png'

$canvas = New-Object System.Drawing.Bitmap(1179, 2556)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$blue = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#017AF4'))

try {
  $graphics.FillRectangle($blue, 0, 0, 1179, 2556)
  $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $outputPath
}
finally {
  $blue.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}
