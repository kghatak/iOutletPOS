<#
.SYNOPSIS
  Install a "silent print" desktop shortcut for iOutletPOS on Windows.

.DESCRIPTION
  Creates a Chrome / Edge shortcut that launches the POS URL with
  `--kiosk-printing`. In that mode `window.print()` skips the system
  print dialog and silently sends jobs to the Windows default printer,
  which is exactly what `printThermalInvoice` calls after every
  "Confirm & Place Order".

  The shortcut opens Chrome in a normal maximised window (no tab bar,
  no URL bar via --app=) so staff can still:
    - Alt+Tab to other apps
    - See the Windows taskbar
    - Close the window with Alt+F4 or the X button
    - Minimise / resize as needed

  Optional switches:
    -Startup       : create a Startup shortcut so POS opens on boot.
    -Kiosk         : FULL LOCKDOWN — hides taskbar, blocks Alt+Tab,
                     no close button. Only for dedicated public kiosks.
                     Staff will need Alt+F4 or Ctrl+Alt+Delete to exit.
    -SilentPolicy  : set Chrome / Edge enterprise policy
                     `PrintPreviewDisabled = 1` (HKLM) so the print
                     preview window never appears at all. Requires
                     admin elevation; the script will re-launch itself
                     elevated if necessary.

.PARAMETER PosUrl
  The URL of the deployed POS app, e.g. https://pos.example.com or
  http://localhost:5173 for local dev.

.PARAMETER Name
  Display name of the shortcut. Default: "iOutletPOS".

.PARAMETER Browser
  Which browser to launch. One of: auto (default), chrome, edge.
  `auto` picks Chrome if installed, else Edge.

.EXAMPLE
  # Recommended for shop POS (silent print, staff can still switch apps):
  .\install-print-shortcut.ps1 -PosUrl "https://pos.example.com" -SilentPolicy

.EXAMPLE
  # Auto-launch on boot:
  .\install-print-shortcut.ps1 -PosUrl "https://pos.example.com" -SilentPolicy -Startup

.EXAMPLE
  # FULL KIOSK lockdown (dedicated public terminal only — not recommended for staff):
  .\install-print-shortcut.ps1 -PosUrl "https://pos.example.com" -SilentPolicy -Startup -Kiosk
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $PosUrl,

    [string] $Name = "iOutletPOS",

    [ValidateSet("auto", "chrome", "edge")]
    [string] $Browser = "auto",

    [switch] $Startup,

    [switch] $SilentPolicy,

    [switch] $Kiosk
)

$ErrorActionPreference = "Stop"

function Write-Info($msg)    { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)      { Write-Host "  $msg" -ForegroundColor Green }
function Write-WarnLine($msg){ Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Err($msg)     { Write-Host "  $msg" -ForegroundColor Red }

function Test-IsElevated {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object System.Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Restart-ElevatedAndExit {
    param([string[]] $OriginalArgs)
    Write-WarnLine "Re-launching elevated (UAC prompt) to set Print Preview policy..."
    $argString = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" " + ($OriginalArgs -join " ")
    Start-Process -FilePath "powershell.exe" -ArgumentList $argString -Verb RunAs
    exit 0
}

function Set-PrintPreviewPolicy {
    $policyTargets = @(
        @{ Name = "Google Chrome"; Path = "HKLM:\SOFTWARE\Policies\Google\Chrome" },
        @{ Name = "Microsoft Edge"; Path = "HKLM:\SOFTWARE\Policies\Microsoft\Edge" }
    )
    foreach ($t in $policyTargets) {
        try {
            if (-not (Test-Path $t.Path)) {
                New-Item -Path $t.Path -Force | Out-Null
            }
            New-ItemProperty -Path $t.Path -Name "PrintPreviewDisabled" `
                -Value 1 -PropertyType DWord -Force | Out-Null
            Write-Ok "Policy set: $($t.Name) PrintPreviewDisabled = 1"
        } catch {
            Write-Err "Could not set policy for $($t.Name): $($_.Exception.Message)"
        }
    }
}

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
        default  { $c = Find-First $chromeCandidates; if ($c) { return $c }; return Find-First $edgeCandidates }
    }
}

# ── Banner ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "iOutletPOS  -  Silent Print Shortcut Installer" -ForegroundColor White
Write-Host "-----------------------------------------------" -ForegroundColor DarkGray

if ($Kiosk) {
    Write-Host ""
    Write-WarnLine "WARNING: -Kiosk was passed."
    Write-WarnLine "This enables FULL SCREEN LOCKDOWN mode."
    Write-WarnLine "Staff will NOT be able to see the taskbar, Alt+Tab, or close the window normally."
    Write-WarnLine "Only use -Kiosk for a dedicated public terminal."
    Write-WarnLine "To exit kiosk mode: press Alt+F4, or Ctrl+Alt+Delete -> Task Manager -> End Task."
    Write-Host ""
}

# Elevate if -SilentPolicy needs it
if ($SilentPolicy -and -not (Test-IsElevated)) {
    $reArgs = @("-PosUrl `"$PosUrl`"", "-Name `"$Name`"", "-Browser $Browser", "-SilentPolicy")
    if ($Startup) { $reArgs += "-Startup" }
    if ($Kiosk)   { $reArgs += "-Kiosk" }
    Restart-ElevatedAndExit -OriginalArgs $reArgs
}

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
Write-Info "Mode    : $(if ($Kiosk) { 'FULL KIOSK (locked)' } else { 'App window (recommended)' })"

$userDataDir = Join-Path $env:LOCALAPPDATA "iOutletPOS\BrowserProfile"
if (-not (Test-Path $userDataDir)) {
    New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null
}

# ── Build Chrome flags ───────────────────────────────────────────────────────
# --kiosk-printing  : silent print to default printer (no dialog).
# --app=URL         : opens in a standalone window without tab bar / URL bar
#                     but still allows Alt+Tab, taskbar, window controls.
#                     (Only used when NOT in full kiosk mode.)
# --kiosk           : full-screen lockdown. Added only when -Kiosk is set.

if ($Kiosk) {
    $argList = @(
        "--kiosk-printing",
        "--kiosk",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-features=TranslateUI",
        "--user-data-dir=`"$userDataDir`""
    )
} else {
    $argList = @(
        "--kiosk-printing",
        ("--app=" + $PosUrl),
        "--start-maximized",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-features=TranslateUI",
        "--user-data-dir=`"$userDataDir`""
    )
}

if ($SilentPolicy) {
    $argList += "--disable-print-preview"
}

# URL is the navigation target — only needed when NOT using --app= (which already embeds it)
if ($Kiosk) {
    $argList += $PosUrl
}

$argumentString = ($argList -join " ")

# ── Create shortcuts ─────────────────────────────────────────────────────────
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
    $sc.WindowStyle = if ($Kiosk) { 3 } else { 1 }
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

# ── Silent policy ────────────────────────────────────────────────────────────
if ($SilentPolicy) {
    Write-Host ""
    Write-Host "Applying Print Preview policy (no preview flash)" -ForegroundColor White
    Set-PrintPreviewPolicy
    Write-WarnLine "Close all Chrome / Edge windows and re-open the POS shortcut for the policy to take effect."
}

# ── Printer check ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Default printer check" -ForegroundColor White
try {
    $defaultPrinter = (Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction Stop |
        Select-Object -First 1 -ExpandProperty Name)
} catch {
    $defaultPrinter = $null
}
if ($defaultPrinter) {
    Write-Info "Windows default printer : $defaultPrinter"
    Write-WarnLine "Make sure this is your THERMAL receipt printer."
    Write-WarnLine "Change via: Settings -> Bluetooth & devices -> Printers & scanners -> (printer) -> Set as default."
} else {
    Write-Err "No Windows default printer detected."
    Write-WarnLine "Set your thermal printer as default in Settings -> Printers & scanners."
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Open the POS from the '$Name' icon on the Desktop." -ForegroundColor DarkGray
if (-not $Kiosk) {
    Write-Host "  The POS opens in an app window - you can Alt+Tab and use the taskbar normally." -ForegroundColor DarkGray
}
Write-Host ""
