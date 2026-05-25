# =============================================================================
# Mavericks Inventory — Azure Infrastructure Deployment Script (PowerShell)
# Run from the terraform/ directory: .\deploy.ps1
# =============================================================================

param(
    [string]$Action = "apply",    # apply | plan | destroy | output
    [switch]$AutoApprove = $false
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MAVERICKS INVENTORY — Azure Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# == Step 1: Check dependencies ================================================
Write-Host "Checking dependencies..." -ForegroundColor Yellow

if (-not (Get-Command "az" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Azure CLI not found. Install from https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command "terraform" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Terraform not found. Install from https://developer.hashicorp.com/terraform/downloads" -ForegroundColor Red
    exit 1
}

# == Step 2: Azure Login ========================================================
Write-Host ""
Write-Host "Checking Azure login status..." -ForegroundColor Yellow

$accountJson = az account show 2>$null
if (-not $?) {
    Write-Host "Not logged in. Logging in to Azure..." -ForegroundColor Yellow
    az login --tenant Amigo178.onmicrosoft.com
    if (-not $?) {
        Write-Host "ERROR: Azure login failed." -ForegroundColor Red
        exit 1
    }
}

$account = $accountJson | ConvertFrom-Json
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
Write-Host "Tenant:       $($account.tenantId)" -ForegroundColor Green

# == Step 3: Check terraform.tfvars ============================================
if (-not (Test-Path "terraform.tfvars")) {
    Write-Host ""
    Write-Host "ERROR: terraform.tfvars not found!" -ForegroundColor Red
    Write-Host "Copy terraform.tfvars.example to terraform.tfvars and fill in the values." -ForegroundColor Yellow

    # Auto-populate tenant and subscription IDs
    $tenantId = az account show --query tenantId -o tsv
    $subscriptionId = az account show --query id -o tsv

    Copy-Item "terraform.tfvars.example" "terraform.tfvars"
    (Get-Content "terraform.tfvars") -replace "PASTE_YOUR_TENANT_ID_HERE", $tenantId | Set-Content "terraform.tfvars"
    (Get-Content "terraform.tfvars") -replace "PASTE_YOUR_SUBSCRIPTION_ID_HERE", $subscriptionId | Set-Content "terraform.tfvars"

    Write-Host ""
    Write-Host "Created terraform.tfvars with your tenant ID and subscription ID." -ForegroundColor Green
    Write-Host "IMPORTANT: Update the following before running again:" -ForegroundColor Yellow
    Write-Host "  - postgres_admin_password (change from default)" -ForegroundColor Yellow
    Write-Host "  - jwt_secret (generate with: openssl rand -base64 48)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Edit the file and re-run this script." -ForegroundColor Cyan
    exit 0
}

# == Step 4: Terraform Init ====================================================
Write-Host ""
Write-Host "Initializing Terraform..." -ForegroundColor Yellow
terraform init -upgrade
if (-not $?) { Write-Host "ERROR: terraform init failed." -ForegroundColor Red; exit 1 }

# == Step 5: Run requested action ==============================================
Write-Host ""
switch ($Action) {
    "plan" {
        Write-Host "Running terraform plan..." -ForegroundColor Yellow
        terraform plan -out=tfplan
    }
    "apply" {
        Write-Host "Running terraform plan..." -ForegroundColor Yellow
        terraform plan -out=tfplan

        if (-not $AutoApprove) {
            Write-Host ""
            $confirm = Read-Host "Apply this plan? (yes/no)"
            if ($confirm -ne "yes") {
                Write-Host "Aborted." -ForegroundColor Yellow
                exit 0
            }
        }

        Write-Host ""
        Write-Host "Applying Terraform plan..." -ForegroundColor Yellow
        terraform apply tfplan
        if (-not $?) { Write-Host "ERROR: terraform apply failed." -ForegroundColor Red; exit 1 }

        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Deployment Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green

        # Generate .env file for backend
        Write-Host ""
        Write-Host "Generating backend .env file..." -ForegroundColor Yellow
        terraform output -raw backend_env_file | Out-File -FilePath "..\src\backend\.env" -Encoding utf8
        Write-Host "Written to: src/backend/.env" -ForegroundColor Green

        # Print key outputs
        Write-Host ""
        Write-Host "Key Resources:" -ForegroundColor Cyan
        Write-Host "  Backend URL:  $(terraform output -raw backend_url)" -ForegroundColor White
        Write-Host "  Frontend URL: $(terraform output -raw frontend_url)" -ForegroundColor White
        Write-Host "  PostgreSQL:   $(terraform output -raw postgres_server_fqdn)" -ForegroundColor White
        Write-Host "  Key Vault:    $(terraform output -raw key_vault_uri)" -ForegroundColor White
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Deploy backend:  az webapp deploy --resource-group rg-maverick-prod --name $(terraform output -raw backend_app_name) --src-path ../src/backend/dist.zip" -ForegroundColor White
        Write-Host "  2. Seed database:   cd ../src/backend && npm run db:push && npm run db:seed" -ForegroundColor White
        Write-Host "  3. Deploy frontend: Use the Static Web App deployment token" -ForegroundColor White
    }
    "destroy" {
        Write-Host "WARNING: This will DESTROY all Azure resources!" -ForegroundColor Red
        $confirm = Read-Host "Type 'destroy' to confirm"
        if ($confirm -ne "destroy") { Write-Host "Aborted." -ForegroundColor Yellow; exit 0 }
        terraform destroy
    }
    "output" {
        terraform output
    }
    default {
        Write-Host "Unknown action: $Action. Use: apply, plan, destroy, output" -ForegroundColor Red
        exit 1
    }
}
