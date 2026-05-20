<#
.SYNOPSIS
  Install a "silent print" desktop shortcut for iOutletPOS on Windows.

.DESCRIPTION
  Creates a Chrome / Edge shortcut that launches the POS URL with
  `--kiosk-printing`. In that mode `window.print()` skips the system
  print dialog and silently sends jobs to the Windows default printer,
  which is exactly what `printThermalInvoice` calls after every
  "Confirm & Place Order".

  Optional switches:
    -Kiosk    : also add `--kiosk` (full-screen, no tabs / URL bar)
    -Startup  : also create a shortcut in Startup so POS opens on boot

.PARAMETER PosUrl
  The URL of the deployed POS app, e.g. https://pos.example.com or
  http://localhost:5173 for local dev.

.PARAMETER Name
  Display name of the shortcut. Default: "iOutletPOS".

.PARAMETER Browser
  Which browser to launch. One of: auto (default), chrome, edge.
  `auto` picks Chrome if installed, else Edge.

.EXAMPLE
  # Run from PowerShell (no admin needed):
  .\install-print-shortcut.ps1 -PosUrl "https://pos.example.com"

.EXAMPLE
  # Full-screen kiosk + auto-launch on boot:
  .\install-print-shortcut.ps1 -PosUrl "https://pos.example.com" -Kiosk -Startup
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $PosUrl,

    [string] $Name = "iOutletPOS",

    [ValidateSet("auto", "chrome", "edge")]
    [string] $Browser = "auto",

    [switch] $Kiosk,

    [switch] $Startup
)

$ErrorActionPreference = "Stop"

function Write-Info($msg)    { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "  $msg" -ForegroundColor Green }
function Write-WarnLine($msg){ Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "  $msg" -ForegroundColor Red }

function Get-BrowserPath {
    param([string] $Which)

    $chromeCandidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    $edgeCandidates = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )

    function Find-First($paths) {
        foreach ($p in $paths) {
            if (-not [string]::IsNullOrWhiteSpace($p) -and (Test-Path $p)) { return $p }
        }
        return $null
    }

    switch ($Which) {
        "chrome" { return Find-First $chromeCandidates }
        "edge"   { return Find-First $edgeCandidates }
        default {
            $c = Find-First $chromeCandidates
            if ($c) { return $c }
            return Find-First $edgeCandidates
        }
    }
}

Write-Host ""
Write-Host "iOutletPOS  -  Silent Print Shortcut Installer" -ForegroundColor White
Write-Host "-----------------------------------------------" -ForegroundColor DarkGray

$browserPath = Get-BrowserPath -Which $Browser
if (-not $browserPath) {
    Write-Err "Could not find Chrome or Edge on this PC."
    Write-WarnLine "Install Google Chrome (https://www.google.com/chrome) and re-run this script."
    exit 1
}

$browserName = Split-Path $browserPath -Leaf
Write-Info "Browser : $browserName"
Write-Info "Path    : $browserPath"
Write-Info "POS URL : $PosUrl"

# Build argument string: --kiosk-printing is required for silent printing.
# A separate user-data dir keeps POS sessions isolated from a normal browser profile.
$userDataDir = Join-Path $env:LOCALAPPDATA "iOutletPOS\BrowserProfile"
if (-not (Test-Path $userDataDir)) {
    New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null
}

$argList = @(
    "--kiosk-printing",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=TranslateUI",
    "--user-data-dir=`"$userDataDir`""
)

if ($Kiosk) {
    $argList += "--kiosk"
    $argList += "--start-fullscreen"
}

# URL must be last so the browser treats it as the navigation target.
$argList += $PosUrl
$argumentString = ($argList -join " ")

function New-ShortcutFile {
    param(
        [Parameter(Mandatory)] [string] $LnkPath,
        [Parameter(Mandatory)] [string] $TargetPath,
        [Parameter(Mandatory)] [string] $Args,
        [string] $Description = "iOutletPOS (silent print)"
    )

    $parent = Split-Path $LnkPath -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    $wsh = New-Object -ComObject WScript.Shell
    $sc = $wsh.CreateShortcut($LnkPath)
    $sc.TargetPath = $TargetPath
    $sc.Arguments = $Args
    $sc.WorkingDirectory = Split-Path $TargetPath -Parent
    $sc.Description = $Description
    $sc.IconLocation = "$TargetPath,0"
    $sc.WindowStyle = 1
    $sc.Save()
}

$desktop = [Environment]::GetFolderPath("Desktop")
$desktopLnk = Join-Path $desktop "$Name.lnk"

New-ShortcutFile -LnkPath $desktopLnk -TargetPath $browserPath -Args $argumentString
Write-Ok "Created desktop shortcut: $desktopLnk"

if ($Startup) {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $startupLnk = Join-Path $startupDir "$Name.lnk"
    New-ShortcutFile -LnkPath $startupLnk -TargetPath $browserPath -Args $argumentString
    Write-Ok "Created Startup shortcut: $startupLnk"
}

# Detect Windows default printer so the user knows where prints will go.
try {
    $defaultPrinter = (Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction Stop |
        Select-Object -First 1 -ExpandProperty Name)
} catch {
    $defaultPrinter = $null
}

Write-Host ""
Write-Host "Default printer check" -ForegroundColor White
if ($defaultPrinter) {
    Write-Info "Windows default printer : $defaultPrinter"
    Write-WarnLine "Make sure this is your THERMAL receipt printer."
    Write-WarnLine "Change via: Settings -> Bluetooth & devices -> Printers & scanners -> (printer) -> Set as default."
} else {
    Write-Err "No Windows default printer detected."
    Write-WarnLine "Set your thermal printer as default in:"
    Write-WarnLine "  Settings -> Bluetooth & devices -> Printers & scanners -> (printer) -> Set as default."
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Always open the POS via the new '$Name' shortcut so silent print is active." -ForegroundColor DarkGray
Write-Host ""
