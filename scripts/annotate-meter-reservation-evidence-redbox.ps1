$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$imagePath = Join-Path $root "assets/evidence/pre-fixed-fare-20260705/05_meter_reservation_detail_202607050600.png"

$strokeColor = [System.Drawing.Color]::FromArgb(255, 220, 38, 38) # #dc2626
$fillColor = [System.Drawing.Color]::FromArgb(10, 220, 38, 38)
$lineWidth = 4

# Tuned for 780x3654 capture: basic info, itinerary, fixed fare.
$boxes = @(
  @{ Id = "basic-info"; X = 28; Y = 1188; Width = 724; Height = 600 },
  @{ Id = "itinerary"; X = 28; Y = 2478; Width = 724; Height = 890 },
  @{ Id = "fixed-fare"; X = 28; Y = 3378; Width = 724; Height = 170 }
)

$bmp = [System.Drawing.Bitmap]::FromFile($imagePath)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

$pen = New-Object System.Drawing.Pen $strokeColor, $lineWidth
$brush = New-Object System.Drawing.SolidBrush $fillColor

foreach ($box in $boxes) {
  $rect = New-Object System.Drawing.Rectangle $box.X, $box.Y, $box.Width, $box.Height
  $graphics.FillRectangle($brush, $rect)
  $graphics.DrawRectangle($pen, $rect)
}

$graphics.Dispose()
$pen.Dispose()
$brush.Dispose()
$tempPath = [System.IO.Path]::Combine([System.IO.Path]::GetDirectoryName($imagePath), ([System.IO.Path]::GetFileNameWithoutExtension($imagePath) + "._tmp.png"))
$bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Move-Item -Force $tempPath $imagePath

Write-Output ("Annotated " + $imagePath)
