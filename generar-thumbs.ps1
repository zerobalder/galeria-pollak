# ============================================================
#  Genera miniaturas (~600px borde largo) en assets/obras/thumb/
#  a partir de las imagenes ya optimizadas en assets/obras/
# ============================================================
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$base   = "C:\Users\gremi\OneDrive\Documentos\galeria-pintor"
$srcDir = Join-Path $base "assets\obras"
$outDir = Join-Path $srcDir "thumb"
New-Item -ItemType Directory -Force $outDir | Out-Null

$MAX = 600
$Q   = 78

$jpegEnc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Save-Thumb([string]$src, [string]$dst) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $w = $img.Width; $h = $img.Height
    $long = [Math]::Max($w, $h)
    $scale = if ($long -gt $MAX) { $MAX / $long } else { 1.0 }
    $nw = [int][Math]::Round($w * $scale); $nh = [int][Math]::Round($h * $scale)
    if ($nw -lt 1) { $nw = 1 }; if ($nh -lt 1) { $nh = 1 }
    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose()
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Q)
    $bmp.Save($dst, $jpegEnc, $ep)
    $bmp.Dispose()
  } finally { $img.Dispose() }
}

$files = Get-ChildItem $srcDir -File -Filter *.jpg
$i = 0
foreach ($f in $files) {
  $i++
  $dst = Join-Path $outDir $f.Name
  try { Save-Thumb $f.FullName $dst } catch { Write-Host "  ERROR $($f.Name): $_" }
  if ($i % 40 -eq 0) { Write-Host "  ...$i / $($files.Count)" }
}

$sz = (Get-ChildItem $outDir -File | Measure-Object Length -Sum).Sum
Write-Host ("Miniaturas: {0} archivos, {1:N1} MB total" -f (Get-ChildItem $outDir -File).Count, ($sz/1MB))
Write-Host "LISTO"
