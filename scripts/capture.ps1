# Screenshot helper for DUET submission assets.
# Brings Chrome forward on its last tab and captures the page viewport only,
# cropping away browser chrome and the taskbar.
#
#   . .\scripts\capture.ps1
#   Capture-Duet -Name "01-dashboard"

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class DuetWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int t, bool repaint);
}
"@ -ErrorAction SilentlyContinue

$script:OutDir = "E:\Hackathon\duet\evidence\final-ui"

function Get-ChromeWindow {
  Get-Process chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
}

function Focus-Duet {
  param([switch]$SwitchTab)
  $c = Get-ChromeWindow
  if (-not $c) { throw "no chrome window" }
  [DuetWin]::ShowWindow($c.MainWindowHandle, 3) | Out-Null
  [DuetWin]::SetForegroundWindow($c.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 700
  if ($SwitchTab) {
    # DUET is the rightmost tab.
    [System.Windows.Forms.SendKeys]::SendWait("^9")
    Start-Sleep -Milliseconds 1500
  }
}

function Capture-Duet {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [int]$Top = 95,
    [int]$Height = 930,
    [int]$Left = 0,
    [int]$Width = 1920,
    [int]$DelayMs = 1200
  )
  Start-Sleep -Milliseconds $DelayMs
  # Re-assert foreground immediately before grabbing: another window can steal
  # focus during the settle delay and would otherwise appear in the capture.
  $c = Get-ChromeWindow
  if ($c) {
    [DuetWin]::SetForegroundWindow($c.MainWindowHandle) | Out-Null
    Start-Sleep -Milliseconds 450
  }
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)

  $w = [Math]::Min($Width, $b.Width - $Left)
  $h = [Math]::Min($Height, $b.Height - $Top)
  $rect = New-Object System.Drawing.Rectangle $Left, $Top, $w, $h
  $sub = $bmp.Clone($rect, $bmp.PixelFormat)

  if (-not (Test-Path $script:OutDir)) { New-Item -ItemType Directory -Force -Path $script:OutDir | Out-Null }
  $path = Join-Path $script:OutDir "$Name.png"
  $sub.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $sub.Dispose()
  Write-Output "$Name.png  $((Get-Item $path).Length) bytes  ${w}x${h}"
}
