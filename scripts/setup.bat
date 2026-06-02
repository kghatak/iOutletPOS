@echo off
:: ============================================================
::  iOutletPOS - One-click Setup
::  Developer: set POS_URL below, then send this file to client.
::  Client:    double-click this file -> click Yes -> done.
:: ============================================================

:: ---- DEVELOPER: change this URL before sending ----
set POS_URL=https://ioutletpos.onrender.com
:: ---------------------------------------------------

:: --- Self-elevate (triggers UAC "Do you want to allow..." prompt) ---
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    powershell -NoProfile -Command ^
      "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: --- Run the actual setup via PowerShell ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference='Stop';" ^
"$posUrl='%POS_URL%';" ^
"$name='iOutletPOS';" ^
"$userDataDir = Join-Path $env:LOCALAPPDATA 'iOutletPOS\BrowserProfile';" ^
"if (-not (Test-Path $userDataDir)) { New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null }" ^
"" ^
"# Find Chrome or Edge" ^
"$chromePaths = @(" ^
"  \"$env:ProgramFiles\Google\Chrome\Application\chrome.exe\"," ^
"  \"${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe\"," ^
"  \"$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe\"" ^
");" ^
"$edgePaths = @(" ^
"  \"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe\"," ^
"  \"${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe\"" ^
");" ^
"$browserPath = ($chromePaths + $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1);" ^
"if (-not $browserPath) {" ^
"  [System.Windows.Forms.MessageBox]::Show(" ^
"    'Google Chrome or Microsoft Edge was not found on this computer.' + [char]13 + [char]10 +" ^
"    'Please install Google Chrome from https://www.google.com/chrome and run setup again.'," ^
"    'iOutletPOS Setup - Browser Not Found'," ^
"    [System.Windows.Forms.MessageBoxButtons]::OK," ^
"    [System.Windows.Forms.MessageBoxIcon]::Error" ^
"  ) | Out-Null; exit 1" ^
"};" ^
"" ^
"# Build shortcut arguments (app-window mode: clean UI, taskbar still works)" ^
"$args = \"--kiosk-printing --app=$posUrl --start-maximized --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-print-preview --user-data-dir=`\"$userDataDir`\"\";" ^
"" ^
"# Create desktop shortcut" ^
"$wsh = New-Object -ComObject WScript.Shell;" ^
"$desktop = [Environment]::GetFolderPath('Desktop');" ^
"$lnk = $wsh.CreateShortcut(\"$desktop\$name.lnk\");" ^
"$lnk.TargetPath = $browserPath;" ^
"$lnk.Arguments = $args;" ^
"$lnk.WorkingDirectory = Split-Path $browserPath -Parent;" ^
"$lnk.Description = 'iOutletPOS (silent print)';" ^
"$lnk.IconLocation = \"$browserPath,0\";" ^
"$lnk.WindowStyle = 1;" ^
"$lnk.Save();" ^
"" ^
"# Create Startup shortcut (auto-launch on boot)" ^
"$startupDir = [Environment]::GetFolderPath('Startup');" ^
"$lnk2 = $wsh.CreateShortcut(\"$startupDir\$name.lnk\");" ^
"$lnk2.TargetPath = $browserPath;" ^
"$lnk2.Arguments = $args;" ^
"$lnk2.WorkingDirectory = Split-Path $browserPath -Parent;" ^
"$lnk2.Description = 'iOutletPOS (silent print)';" ^
"$lnk2.IconLocation = \"$browserPath,0\";" ^
"$lnk2.WindowStyle = 1;" ^
"$lnk2.Save();" ^
"" ^
"# Registry policy: disable print preview flash" ^
"$policies = @(" ^
"  'HKLM:\SOFTWARE\Policies\Google\Chrome'," ^
"  'HKLM:\SOFTWARE\Policies\Microsoft\Edge'" ^
");" ^
"foreach ($p in $policies) {" ^
"  if (-not (Test-Path $p)) { New-Item -Path $p -Force | Out-Null }" ^
"  New-ItemProperty -Path $p -Name 'PrintPreviewDisabled' -Value 1 -PropertyType DWord -Force | Out-Null" ^
"};" ^
"" ^
"Add-Type -AssemblyName System.Windows.Forms;" ^
"[System.Windows.Forms.MessageBox]::Show(" ^
"  'Setup complete!' + [char]13 + [char]10 + [char]13 + [char]10 +" ^
"  'The iOutletPOS icon has been added to your Desktop.' + [char]13 + [char]10 +" ^
"  'It will also open automatically when you start your computer.' + [char]13 + [char]10 + [char]13 + [char]10 +" ^
"  'Steps to finish:' + [char]13 + [char]10 +" ^
"  '1. Close this window.' + [char]13 + [char]10 +" ^
"  '2. Make sure your thermal printer is set as the Default Printer in Windows.' + [char]13 + [char]10 +" ^
"  '3. Double-click the iOutletPOS icon on your Desktop to open the app.'," ^
"  'iOutletPOS Setup - Done'," ^
"  [System.Windows.Forms.MessageBoxButtons]::OK," ^
"  [System.Windows.Forms.MessageBoxIcon]::Information" ^
") | Out-Null"

if %errorLevel% NEQ 0 (
    powershell -NoProfile -Command ^
      "Add-Type -AssemblyName System.Windows.Forms;" ^
      "[System.Windows.Forms.MessageBox]::Show(" ^
      "  'Setup did not complete. Please contact your IT support.'," ^
      "  'iOutletPOS Setup - Error'," ^
      "  [System.Windows.Forms.MessageBoxButtons]::OK," ^
      "  [System.Windows.Forms.MessageBoxIcon]::Error" ^
      ") | Out-Null"
)
