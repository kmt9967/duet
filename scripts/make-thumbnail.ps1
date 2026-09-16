# Builds the 1280x720 YouTube thumbnail from a real DUET production screenshot.
# No stock art, no invented UI — the background is the actual simulator.

Add-Type -AssemblyName System.Drawing

$src  = "E:\Hackathon\duet\evidence\final-ui\00-cover.png"
$dest = "E:\Hackathon\duet\evidence\final-ui\youtube-thumbnail.png"

$img = [System.Drawing.Image]::FromFile($src)

$W = 1280; $H = 720
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.InterpolationMode = 'HighQualityBicubic'
$g.TextRenderingHint = 'ClearTypeGridFit'

# --- background: the workspace region of the real screenshot, 16:9 ---------
$cropX = 243; $cropY = 205; $cropW = 858; $cropH = 483
$srcRect  = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
$destRect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

# --- darken so text stays readable on mobile ------------------------------
$veil = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 5, 7, 13))
$g.FillRectangle($veil, 0, 0, $W, $H)

# stronger vignette on the lower half where the text sits
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 0, 250),
  (New-Object System.Drawing.Point 0, 720),
  [System.Drawing.Color]::FromArgb(0, 5, 7, 13),
  [System.Drawing.Color]::FromArgb(225, 5, 7, 13))
$g.FillRectangle($grad, 0, 250, $W, 470)

# --- accent rule ----------------------------------------------------------
$cyan    = [System.Drawing.Color]::FromArgb(56, 189, 248)
$magenta = [System.Drawing.Color]::FromArgb(244, 114, 182)
$bar = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 70, 0),
  (New-Object System.Drawing.Point 430, 0), $cyan, $magenta)
$g.FillRectangle($bar, 70, 470, 360, 7)

# --- type -----------------------------------------------------------------
$fDuet  = New-Object System.Drawing.Font("Segoe UI", 132, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fLine  = New-Object System.Drawing.Font("Segoe UI Semibold", 52, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fKicker= New-Object System.Drawing.Font("Consolas", 26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$cyanB = New-Object System.Drawing.SolidBrush $cyan
$magB  = New-Object System.Drawing.SolidBrush $magenta
$mute  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(203, 213, 225))

$g.DrawString("DUET", $fDuet, $white, 60, 300)
$g.DrawString("SPEAK.  PLAN.  MOVE.", $fLine, $mute, 72, 500)

# kicker, split so the arrow colours read as the two arms
$k1 = "VOICE"; $k2 = ">"; $k3 = "TWO ROBOT ARMS"
$x = 74.0
$ky = 596.0
$pad = 22.0
$g.DrawString($k1, $fKicker, $cyanB, $x, $ky)
$x = $x + $g.MeasureString($k1, $fKicker).Width - 10 + $pad
$g.DrawString($k2, $fKicker, $mute, $x, $ky)
$x = $x + $g.MeasureString($k2, $fKicker).Width - 10 + $pad
$g.DrawString($k3, $fKicker, $magB, $x, $ky)

# --- corner badge ---------------------------------------------------------
$fBadge = New-Object System.Drawing.Font("Consolas", 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$badge  = "AI INFRA SUMMIT HACKATHON"
$bw = $g.MeasureString($badge, $fBadge).Width
$g.DrawString($badge, $fBadge, $cyanB, ($W - $bw - 60), 52)

$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()

$f = Get-Item $dest
Write-Output "thumbnail: $($f.Length) bytes  (limit 2MB)"
