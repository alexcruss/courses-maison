# Dessine les icones de l'appli (panier dore, tomate, feuilles) avec System.Drawing.
# Utilisation : powershell -ExecutionPolicy Bypass -File tools\icones.ps1
param([string]$Dossier = (Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'))

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $Dossier | Out-Null

function Couleur([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }

# marge : part du bord laissee vide (plus grande pour l'icone "maskable" d'Android)
function Dessiner([int]$taille, [string]$nom, [double]$marge) {
  $bmp = New-Object System.Drawing.Bitmap $taille, $taille
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  # Fond : degrade vert, pleine page (iOS arrondit lui-meme les coins)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $taille, $taille
  # Brosse un peu plus grande que l'image : evite un liseré clair sur les bords
  $large = New-Object System.Drawing.Rectangle -2, -2, ($taille + 4), ($taille + 4)
  $fond = New-Object System.Drawing.Drawing2D.LinearGradientBrush $large, (Couleur '#8CC63F'), (Couleur '#2F6119'), 60
  $g.FillRectangle($fond, $rect)

  # Repere de dessin : un carre de 100 x 100 dans la zone utile
  $u = $taille * (1 - 2 * $marge) / 100.0
  $o = $taille * $marge
  function X([double]$v) { [float]($o + $v * $u) }
  function Pt([double]$x, [double]$y) { New-Object System.Drawing.PointF (X $x), (X $y) }

  # Anse du panier
  $anse = New-Object System.Drawing.Pen (Couleur '#FFE08A'), ([float](6 * $u))
  $g.DrawArc($anse, (X 24), (X 14), [float](52 * $u), [float](64 * $u), 180, 180)

  # Contenu : feuilles vertes, tomate rouge, piment
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (Couleur '#5DBB4A')), (X 50), (X 26), [float](24 * $u), [float](30 * $u))
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (Couleur '#3E9B33')), (X 58), (X 30), [float](22 * $u), [float](24 * $u))
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (Couleur '#E2483A')), (X 26), (X 32), [float](28 * $u), [float](26 * $u))
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (Couleur '#F0705F')), (X 32), (X 36), [float](8 * $u), [float](6 * $u))
  $g.FillPolygon((New-Object System.Drawing.SolidBrush (Couleur '#2F6119')), [System.Drawing.PointF[]]@((Pt 36 31), (Pt 40 27), (Pt 44 31), (Pt 40 34)))

  # Corps du panier
  $or = New-Object System.Drawing.SolidBrush (Couleur '#F4B740')
  $g.FillPolygon($or, [System.Drawing.PointF[]]@((Pt 14 52), (Pt 86 52), (Pt 77 86), (Pt 23 86)))
  $g.FillRectangle((New-Object System.Drawing.SolidBrush (Couleur '#D9952A')), (X 11), (X 48), [float](78 * $u), [float](9 * $u))
  $tresse = New-Object System.Drawing.Pen (Couleur '#C9831F'), ([float](3 * $u))
  foreach ($x in 32, 50, 68) { $g.DrawLine($tresse, (Pt $x 60), (Pt ($x + ($x - 50) * 0.12) 83)) }
  $g.DrawLine($tresse, (Pt 19 70), (Pt 81 70))

  $chemin = Join-Path $Dossier $nom
  $bmp.Save($chemin, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "Icone creee : $chemin"
}

Dessiner 180 'icon-180.png' 0.1
Dessiner 192 'icon-192.png' 0.1
Dessiner 512 'icon-512.png' 0.1
Dessiner 512 'icon-maskable-512.png' 0.18
