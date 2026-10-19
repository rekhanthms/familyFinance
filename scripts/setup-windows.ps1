# Family Finance - Windows setup and launcher.
#   setup.bat  runs this with no options: checks everything, installs what is missing, starts the app.
#   start.bat  runs this with -Start: quick start (installs only if something is missing).
# Safe to run again at any time. It never deletes your files. Needs no administrator rights.
param([switch]$Start)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # makes downloads much faster in Windows PowerShell
$env:NG_CLI_ANALYTICS = 'false'            # stops Angular asking a question that would freeze the window
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
$env:npm_config_update_notifier = 'false'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Step($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Green }
function Info($text) { Write-Host $text }
function Warn($text) { Write-Host $text -ForegroundColor Yellow }
function Fail($text) {
  Write-Host ""; Write-Host "STOPPED: $text" -ForegroundColor Red
  Write-Host "Take a screenshot of this window and send it to Claude." -ForegroundColor Red
  exit 1
}
trap { Fail ("Unexpected problem: " + $_.Exception.Message) }

Write-Host "Family Finance installer, version 5" -ForegroundColor Cyan

# ---------- 0. Where are we? ----------
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Fail "package.json was not found. Extract the whole zip first (right-click, Extract All), then open the extracted folder."
}
if ($root -like "$env:TEMP*" -or $root -like '*\AppData\Local\Temp\*') {
  Fail "You are running this from inside the zip. Right-click the zip, choose Extract All, to C:\ , then double-click setup.bat in the extracted folder."
}
if ($root.Length -gt 60) {
  Fail "This folder path is too long ($root). Move the folder to C:\family-finance and run setup.bat again."
}
if ($root -like '*OneDrive*') {
  Warn "This folder is inside OneDrive, which can slow down or break installs. C:\family-finance is safer."
}
$tools = Join-Path $root '.tools'
$privNode = Join-Path $tools 'node'
$privNpm = Join-Path $tools 'npm'

# ---------- helpers ----------
function Node-Ok {
  try {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $cmd) { return $false }
    $v = (& node --version).TrimStart('v').Split('.')
    $major = [int]$v[0]; $minor = [int]$v[1]
    return ($major -ge 24) -or ($major -eq 22 -and $minor -ge 12)
  } catch { return $false }
}
function Npm-Major {
  try { return [int]((& npm --version).Trim().Split('.')[0]) } catch { return 0 }
}
function Use-Private-Tools {
  # Order matters: Node first, then the private npm 11 in front of it (Node's own folder holds an older npm).
  if (Test-Path (Join-Path $privNode 'node.exe')) { $env:Path = "$privNode;$env:Path" }
  if (Test-Path (Join-Path $privNpm 'node_modules\.bin\npm.cmd')) { $env:Path = (Join-Path $privNpm 'node_modules\.bin') + ";$env:Path" }
}
function Run-Native($label, [scriptblock]$cmd, [int]$tries = 1) {
  for ($i = 1; $i -le $tries; $i++) {
    & $cmd
    if ($LASTEXITCODE -eq 0) { return $true }
    if ($i -lt $tries) { Warn "$label did not finish. Trying once more..." ; Start-Sleep -Seconds 3 }
  }
  return $false
}
function Free-Port {
  foreach ($p in 4200..4215) {
    $busy = $false
    try { $l = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $p); $l.Start(); $l.Stop() } catch { $busy = $true }
    if (-not $busy) { return $p }
  }
  return 4200
}

# ---------- 1. Computer basics ----------
Step "1 of 5: Checking this computer"
$drive = Get-PSDrive -Name ($root.Substring(0, 1)) -ErrorAction SilentlyContinue
if ($drive -and $drive.Free -lt 2GB) {
  Fail ("Only {0:N1} GB free on drive {1}. Free up at least 2 GB and run setup.bat again." -f ($drive.Free / 1GB), $root.Substring(0, 1))
}
try {
  $mem = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB
  if ($mem -lt 1.5) { Warn ("Only {0:N1} GB of memory is free. Close some programs (browser tabs, Teams) if the build is slow." -f $mem) }
} catch {}
if (-not (Test-Path (Join-Path $privNode 'node.exe')) -or -not (Test-Path (Join-Path $root 'node_modules'))) {
  # First run: we need the internet.
  try { Invoke-WebRequest -UseBasicParsing -Uri 'https://registry.npmjs.org/' -TimeoutSec 20 | Out-Null }
  catch { Fail "Cannot reach the internet (registry.npmjs.org). Connect to the internet (turn off VPN if you use one) and run setup.bat again." }
}
Info "Disk space and connection look fine."

# ---------- 2. Node.js ----------
Step "2 of 5: Node.js"
Use-Private-Tools
if (-not (Node-Ok)) {
  # Use the Node.js already on the PC if it is new enough; otherwise download a private copy into this
  # project's .tools folder. No administrator rights needed, and your own Node.js is left alone.
  $found = Get-Command node -ErrorAction SilentlyContinue
  if ($found) { Warn ("Your PC has Node.js " + (& node --version) + ", which is too old for this app.") }
  else { Warn "Node.js is not installed." }
  Info "Downloading a private copy of Node.js 22 (about 30 MB)..."
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  try { $index = Invoke-RestMethod -UseBasicParsing -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 60 }
  catch { Fail "Could not reach nodejs.org. Check your internet connection (or VPN) and run setup.bat again." }
  $release = $index | Where-Object { $_.lts -and $_.version -like 'v22.*' -and ($_.files -contains "win-$arch-zip") } | Select-Object -First 1
  if (-not $release) { Fail "Could not find a Node.js 22 download for this computer. Install Node.js LTS from https://nodejs.org and run setup.bat again." }
  $zipName = "node-$($release.version)-win-$arch"
  $zip = Join-Path $env:TEMP "$zipName.zip"
  Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$($release.version)/$zipName.zip" -OutFile $zip
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  if (Test-Path $privNode) { Remove-Item -Recurse -Force $privNode }
  Expand-Archive -Force -Path $zip -DestinationPath $tools
  Rename-Item (Join-Path $tools $zipName) 'node'
  Remove-Item -Force $zip
  Use-Private-Tools
  if (-not (Node-Ok)) { Fail "The downloaded Node.js did not start. Your antivirus may have blocked it. Allow the .tools folder and run setup.bat again." }
}
Info ("Node.js " + (& node --version) + " is ready.")

# ---------- 3. npm 11 ----------
Step "3 of 5: npm 11"
if ((Npm-Major) -lt 11) {
  Info "Installing npm 11 inside the project (no administrator rights needed)..."
  New-Item -ItemType Directory -Force -Path $privNpm | Out-Null
  $ok = Run-Native 'npm update' { npm install --prefix "$privNpm" npm@11.6.2 --no-audit --no-fund --loglevel=error } 2
  if (-not $ok) { Fail "Could not download npm. Check your internet connection and run setup.bat again." }
  Use-Private-Tools
  if ((Npm-Major) -lt 11) { Fail "npm 11 did not activate. Delete the .tools folder inside the project and run setup.bat again." }
}
Info ("npm " + (& npm --version).Trim() + " is ready.")

# ---------- 4. Packages ----------
Step "4 of 5: The app's packages"
$stamp = Join-Path $root 'node_modules\.package-lock.json'
if ((Test-Path $stamp) -and (Test-Path (Join-Path $root 'node_modules\@angular\cli'))) {
  Info "Already installed."
} else {
  Info "Installing (the first time takes 3 to 10 minutes; lines may scroll quickly - that is normal)..."
  $ok = Run-Native 'npm install' { npm install --no-audit --no-fund } 2
  if (-not $ok) { Fail "npm install failed. Scroll up for the red text and send the last 15 lines to Claude." }
}

if (-not $Start) {
  Info ""
  Info "Running a quick self-check..."
  try { node scripts/doctor.mjs } catch {}
  if ($LASTEXITCODE -ne 0) { Warn "Some checks need attention (see above). Continuing anyway." }
}

# ---------- 5. Start ----------
Step "5 of 5: Starting the app"
$port = Free-Port
if ($port -ne 4200) { Warn "Port 4200 is busy (the app may already be running), so using $port instead." }
$url = "http://localhost:$port"
Write-Host "The first start takes up to a minute. When you see 'Local: $url' the app is ready." -ForegroundColor Cyan
Write-Host "Your browser opens by itself. To stop the app press Ctrl+C. To start it again later, double-click start.bat." -ForegroundColor Cyan
Start-Job -ArgumentList $port -ScriptBlock {
  param($p)
  for ($i = 0; $i -lt 180; $i++) {
    try { Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$p" -TimeoutSec 2 | Out-Null; Start-Process "http://localhost:$p"; return } catch { Start-Sleep -Seconds 2 }
  }
} | Out-Null
# Call Angular directly: PowerShell swallows the "--" that npm needs to pass the port on.
node (Join-Path $root 'node_modules\@angular\cli\bin\ng.js') serve --port $port
