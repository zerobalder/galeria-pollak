Add-Type -AssemblyName System.Drawing
$src = New-Object System.Drawing.Bitmap "C:\Users\gremi\Downloads\firma.png"
$w = $src.Width; $h = $src.Height
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)

$minX = $w; $minY = $h; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $h; $y++) {
  $row = $y * $stride
  for ($x = 0; $x -lt $w; $x++) {
    $a = $bytes[$row + $x * 4 + 3]
    if ($a -gt 24) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
if ($maxX -lt 0) { Write-Host "sin contenido"; exit 1 }
$pad = 8
$minX = [Math]::Max(0, $minX - $pad); $minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($w - 1, $maxX + $pad); $maxY = [Math]::Min($h - 1, $maxY + $pad)
$cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
Write-Host ("bbox: {0},{1} {2}x{3}" -f $minX, $minY, $cw, $ch)

$crop = New-Object System.Drawing.Bitmap $cw, $ch
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch), $minX, $minY, $cw, $ch, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$dst = "C:\Users\gremi\OneDrive\Documentos\galeria-pintor\assets\firma.png"
$crop.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose(); $src.Dispose()
"guardada: {0} ({1}x{2}), {3:N0} bytes" -f $dst, $cw, $ch, ((Get-Item $dst).Length)
