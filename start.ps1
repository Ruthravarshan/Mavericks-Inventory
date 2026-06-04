# ─────────────────────────────────────────────────────────────────────────────
#  Mavericks Inventory — Dev Startup Script (Windows PowerShell)
#  Starts: Backend (8080) · Frontend (5173) · Agent (9090)
#  Usage:  .\start.ps1
#  Tip:    Each service opens in its own PowerShell window.
#          Close the window to stop that service.
# ─────────────────────────────────────────────────────────────────────────────

$ScriptDir = $PSScriptRoot

function Write-Step($msg) { Write-Host "`n▸ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

# ─── Banner ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     Mavericks Inventory System       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Environment files ─────────────────────────────────────────────────────
Write-Step "Environment setup"
foreach ($svc in @("backend", "frontend", "agent")) {
    $dir = "$ScriptDir\src\$svc"
    $envFile = "$dir\.env"
    $exampleFile = "$dir\.env.example"

    if (-not (Test-Path $envFile)) {
        if (Test-Path $exampleFile) {
            Copy-Item $exampleFile $envFile
            Write-Warn "src/$svc/.env created from .env.example — fill in your Azure credentials"
        } else {
            Write-Warn "No .env.example found in src/$svc"
        }
    } else {
        Write-Ok "src/$svc/.env found"
    }
}

# ─── 2. Install dependencies ──────────────────────────────────────────────────
Write-Step "Checking dependencies"
foreach ($svc in @("backend", "frontend", "agent")) {
    $dir = "$ScriptDir\src\$svc"
    $modules = "$dir\node_modules"

    if (-not (Test-Path $modules)) {
        Write-Host "  Installing src/$svc (this may take a minute)..." -ForegroundColor Yellow
        Push-Location $dir
        npm install --silent
        Pop-Location
        Write-Ok "src/$svc — installed"
    } else {
        Write-Ok "src/$svc — node_modules OK"
    }
}

# ─── 3. Launch services in separate windows ───────────────────────────────────
Write-Step "Launching services"
Write-Host "  Backend  → http://localhost:8080  (API)" -ForegroundColor White
Write-Host "  Frontend → http://localhost:5173  (UI)"  -ForegroundColor White
Write-Host "  Agent    → http://localhost:9090  (AI Agent)" -ForegroundColor White

$services = @(
    @{ Name = "Backend";  Dir = "$ScriptDir\src\backend";  Color = "Green"  },
    @{ Name = "Frontend"; Dir = "$ScriptDir\src\frontend"; Color = "Blue"   },
    @{ Name = "Agent";    Dir = "$ScriptDir\src\agent";    Color = "Yellow" }
)

foreach ($svc in $services) {
    $name = $svc.Name
    $dir  = $svc.Dir

    # Check if Windows Terminal is available for a nicer experience
    $wtAvailable = $null -ne (Get-Command wt -ErrorAction SilentlyContinue)

    if ($wtAvailable) {
        Start-Process wt -ArgumentList @(
            "new-tab",
            "--title", "Mavericks $name",
            "powershell", "-NoExit",
            "-Command", "Set-Location '$dir'; npm run dev"
        )
    } else {
        Start-Process powershell -ArgumentList @(
            "-NoExit",
            "-Command",
            "`$Host.UI.RawUI.WindowTitle = 'Mavericks $name'; Set-Location '$dir'; npm run dev"
        )
    }

    Write-Ok "$name launched"
    Start-Sleep -Milliseconds 400
}

Write-Host ""
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  All 3 services are running in separate windows." -ForegroundColor Green
Write-Host "  Close a window to stop that service." -ForegroundColor Gray
Write-Host ""
Write-Host "  Logs:" -ForegroundColor DarkGray
Write-Host "    Backend  → Green window titled 'Mavericks Backend'"  -ForegroundColor DarkGray
Write-Host "    Frontend → Blue window titled 'Mavericks Frontend'"  -ForegroundColor DarkGray
Write-Host "    Agent    → Yellow window titled 'Mavericks Agent'"   -ForegroundColor DarkGray
Write-Host ""
