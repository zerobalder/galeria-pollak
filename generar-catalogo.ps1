# ============================================================
#  Genera assets/obras/*.jpg (optimizadas) + data.js
#  a partir de las fotos en assets/_extract
# ============================================================
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$base    = "C:\Users\gremi\OneDrive\Documentos\galeria-pintor"
$srcCuad = Join-Path $base "assets\_extract\Cuadros sin sobreimpresion"
$srcDib  = Join-Path $srcCuad "Dibujos con modelos"
$outDir  = Join-Path $base "assets\obras"
New-Item -ItemType Directory -Force $outDir | Out-Null

$MAX = 1800
$Q   = 82

# ---------- utilidades ----------
function Norm([string]$s) {
  $s = $s.ToLower().Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object Text.StringBuilder
  foreach ($c in $s.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
  }
  return $sb.ToString()
}
function Slug([string]$s) {
  $n = Norm $s
  $n = $n -replace "[^a-z0-9]+","-"
  $n = $n.Trim("-")
  if ([string]::IsNullOrWhiteSpace($n)) { $n = "obra" }
  return $n
}

$jpegEnc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Save-Resized([string]$src, [string]$dst) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $orient = 1
    try { if ($img.PropertyIdList -contains 274) { $orient = [int]$img.GetPropertyItem(274).Value[0] } } catch {}
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
    switch ($orient) {
      3 { $bmp.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      6 { $bmp.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      8 { $bmp.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Q)
    $bmp.Save($dst, $jpegEnc, $ep)
    $bmp.Dispose()
  } finally { $img.Dispose() }
}

# ---------- clasificacion ----------
function Get-Cat([string]$tn) {
  if ($tn -match 'huaso|machi|mercado|minga|esquila|cosech|pescador|maquinista|tornero|obras public|pesca industrial|pesca artesanal') { return 'escenas' }
  if ($tn -match 'desnud|desbud|mujer|hombre|retrato|musa|torso|torzo|bailarin|asistente|camarera|sobrecargo|ninfa|melliza|neanderthal|autoretrato|autorretrato|chaise|tendida|sentada|sobre cama|cuclillas|\bpose\b|cabana|nin[oa]\b|modelo|senora|sefora|dama|mi amiga|anne') { return 'figura' }
  if ($tn -match 'bote|velero|\bplaya\b|puerto|puertecito|caribe|caburgua|zapallar|bahia|muelle|\bmar\b|marea|ensenada|calbuco|pargua|sosua|sousa|jamaica|costa|boya|angelmo|isla|renahue|castillo en el mar|frente a.?mar|pueblo frente') { return 'marinas' }
  if ($tn -match 'lago|\brio\b|montan|valle|atacama|uyuni|salar|patagonia|paine|arbol|volcan|petrohue|altiplano|camino|riachuelo|remanso|nieve|puelo|cruces|tolten|trafanpulli|chicureo|salto|roca|bosque|selva|cerro|artico|fin del mundo|horizonte|plantas') { return 'paisajes' }
  return 'paisajes'
}
$temaMap = @{ marinas='Marina'; paisajes='Paisaje'; figura='Figura'; escenas='Costumbrista'; dibujos='Desnudo' }

# ---------- parseo de nombre ----------
function Parse-Nombre([string]$fname) {
  $stem = [IO.Path]::GetFileNameWithoutExtension($fname)
  $num = ""
  $rest = $stem
  if ($stem -match '^\s*(\d+(?:\.\d+)?)\s+(.*)$') { $num = $matches[1]; $rest = $matches[2] }
  # ultimo anio de 4 digitos
  $anio = $null
  $mm = [regex]::Matches($rest, '\b(19|20)\d{2}\b')
  if ($mm.Count -gt 0) { $anio = [int]$mm[$mm.Count-1].Value; $rest = $rest.Remove($mm[$mm.Count-1].Index).Trim() }
  # limpiar cola de basura (PP, numeros sueltos, guiones)
  $rest = $rest -replace '\bPP\b',''
  $rest = $rest -replace '[_]+',' '
  $rest = $rest -replace '\s+\d+\s*$',''     # numero suelto al final (ej "2","3")
  $rest = ($rest -replace '\s{2,}',' ').Trim(" -.,")
  if ([string]::IsNullOrWhiteSpace($rest)) { $rest = if ($num) { "Obra $num" } else { "Obra sin titulo" } }
  # Capitalizar primera letra
  if ($rest.Length -ge 1) { $rest = $rest.Substring(0,1).ToUpper() + $rest.Substring(1) }
  return [pscustomobject]@{ num=$num; titulo=$rest; anio=$anio }
}

# ---------- procesar ----------
$obras = New-Object System.Collections.ArrayList
$seen  = @{}
$idx = 0

function Add-Obra([string]$path, [string]$forceCat) {
  $script:idx++
  $file = Split-Path $path -Leaf
  if ($file -eq '.DS_Store') { return }
  $len = (Get-Item $path).Length
  if ($len -lt 20480) { Write-Host "  (omito thumbnail $file)"; return }  # <20KB = miniatura rota
  $p = Parse-Nombre $file
  $tn = Norm $p.titulo
  $cat = if ($forceCat) { $forceCat } else { Get-Cat $tn }
  $tec = if ($forceCat -eq 'dibujos') { 'Lápiz' } elseif ($tn -match 'bosquejo') { 'Bosquejo' } elseif ($tn -match 'dibujo') { 'Dibujo' } else { 'Óleo' }
  $tema = $temaMap[$cat]
  # id unico
  $base = if ($p.num) { (Slug $p.num) + '-' + (Slug $p.titulo) } else { Slug $p.titulo }
  $id = $base; $n = 2
  while ($seen.ContainsKey($id)) { $id = "$base-$n"; $n++ }
  $seen[$id] = $true
  $dst = Join-Path $outDir "$id.jpg"
  if (-not (Test-Path $dst)) {
    try { Save-Resized $path $dst } catch { Write-Host "  ERROR resize $file : $_"; return }
  }
  $obj = [ordered]@{
    id        = $id
    titulo    = $p.titulo
    anio      = $p.anio
    categoria = $cat
    tematica  = $tema
    tecnica   = $tec
    medidas   = ""
    imagen    = "assets/obras/$id.jpg"
    destacada = $false
  }
  if ($p.PSObject.Properties['num']) { }
  [void]$script:obras.Add([pscustomobject]$obj)
  if ($script:idx % 25 -eq 0) { Write-Host "  ...$($script:idx) procesadas" }
}

Write-Host "Procesando cuadros..."
Get-ChildItem $srcCuad -File | Sort-Object Name | ForEach-Object { Add-Obra $_.FullName $null }
Write-Host "Procesando dibujos con modelos..."
Get-ChildItem $srcDib -File | Sort-Object Name | ForEach-Object { Add-Obra $_.FullName 'dibujos' }

Write-Host ("Total obras: " + $obras.Count)

# ---------- destacadas: hasta 2 recientes por categoria principal ----------
foreach ($c in 'marinas','paisajes','figura','escenas') {
  $obras | Where-Object { $_.categoria -eq $c } | Sort-Object { $_.anio } -Descending | Select-Object -First 2 | ForEach-Object { $_.destacada = $true }
}

# ---------- construir data.js ----------
$ARTIST = [ordered]@{
  nombre="Peter Pollak"; disciplina="Pintor"; ciudad="Temuco · Santiago, Chile";
  anios="Obra 1971 — 2026";
  bio="Pinto lo que veo y lo que recuerdo: el mar y los lagos del sur, la gente en sus faenas, el cuerpo del natural. Cada cuadro intenta detener la luz un instante antes de que se disuelva.";
  retrato="assets/retrato.jpg"; email="hola@peterpollak.cl"; instagram="https://instagram.com/";
}
$TEMATICAS = @("Marina","Paisaje","Figura","Costumbrista")
$TECNICAS  = @("Óleo","Dibujo","Bosquejo","Lápiz")
$CATEGORIAS = @(
  [ordered]@{ slug="marinas";  nombre="Marinas";           descripcion="Botes, veleros y orillas: el mar y los lagos del sur como horizonte y memoria." },
  [ordered]@{ slug="paisajes"; nombre="Paisajes";          descripcion="De la cordillera y el altiplano a la Patagonia; ríos, bosques y volcanes." },
  [ordered]@{ slug="figura";   nombre="Figura y retrato";  descripcion="El cuerpo y el rostro pintados del natural: desnudos, musas y retratos." },
  [ordered]@{ slug="escenas";  nombre="Escenas y oficios"; descripcion="Huasos, pescadores, mercados y faenas: la vida de la gente y su trabajo." },
  [ordered]@{ slug="dibujos";  nombre="Dibujos";           descripcion="Apuntes a lápiz del natural, muchos de ellos base de óleos posteriores." }
)

function ToJson($o) { $o | ConvertTo-Json -Depth 6 -Compress:$false }

$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine("/* Generado automaticamente desde las fotos del catalogo. Editable a mano. */")
[void]$sb.AppendLine("const ARTIST = " + (ToJson $ARTIST) + ";")
[void]$sb.AppendLine("const TEMATICAS = " + (ToJson $TEMATICAS) + ";")
[void]$sb.AppendLine("const TECNICAS = " + (ToJson $TECNICAS) + ";")
[void]$sb.AppendLine("const CATEGORIAS = " + (ToJson $CATEGORIAS) + ";")
[void]$sb.AppendLine("const OBRAS = " + (ToJson @($obras)) + ";")

$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $base "data.js"), $sb.ToString(), $utf8)

# resumen por categoria
Write-Host "--- Resumen ---"
$obras | Group-Object categoria | Sort-Object Name | ForEach-Object { "{0,-10} {1}" -f $_.Name, $_.Count }
$dst2 = Join-Path $outDir "*"
$sz = (Get-ChildItem $outDir -File | Measure-Object Length -Sum).Sum
Write-Host ("Peso total optimizado: {0:N1} MB" -f ($sz/1MB))
Write-Host "LISTO"
