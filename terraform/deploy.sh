#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Mavericks Inventory — Azure Infrastructure Deployment Script (Bash)
# Usage: ./deploy.sh [apply|plan|destroy|output]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ACTION="${1:-apply}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "  MAVERICKS INVENTORY — Azure Deploy"
echo "========================================"
echo ""

# ── Step 1: Check dependencies ────────────────────────────────────────────────
echo "Checking dependencies..."

if ! command -v az &>/dev/null; then
    echo "ERROR: Azure CLI not found."
    echo "Install: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

if ! command -v terraform &>/dev/null; then
    echo "ERROR: Terraform not found."
    echo "Install: https://developer.hashicorp.com/terraform/downloads"
    exit 1
fi

# ── Step 2: Azure Login ────────────────────────────────────────────────────────
echo ""
echo "Checking Azure login status..."

if ! az account show &>/dev/null; then
    echo "Not logged in. Logging in..."
    az login --tenant Amigo178.onmicrosoft.com
fi

ACCOUNT_NAME=$(az account show --query name -o tsv)
ACCOUNT_USER=$(az account show --query user.name -o tsv)
echo "Logged in as: $ACCOUNT_USER"
echo "Subscription: $ACCOUNT_NAME"

# ── Step 3: Check terraform.tfvars ────────────────────────────────────────────
if [ ! -f "terraform.tfvars" ]; then
    echo ""
    echo "terraform.tfvars not found. Creating from example..."
    cp terraform.tfvars.example terraform.tfvars

    TENANT_ID=$(az account show --query tenantId -o tsv)
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)

    sed -i "s/PASTE_YOUR_TENANT_ID_HERE/$TENANT_ID/g" terraform.tfvars
    sed -i "s/PASTE_YOUR_SUBSCRIPTION_ID_HERE/$SUBSCRIPTION_ID/g" terraform.tfvars

    echo ""
    echo "Created terraform.tfvars with tenant ID: $TENANT_ID"
    echo ""
    echo "IMPORTANT: Update these values before running again:"
    echo "  - postgres_admin_password"
    echo "  - jwt_secret  (generate: openssl rand -base64 48)"
    echo ""
    echo "Edit terraform.tfvars and re-run."
    exit 0
fi

# ── Step 4: Terraform Init ────────────────────────────────────────────────────
echo ""
echo "Initializing Terraform..."
terraform init -upgrade

# ── Step 5: Run action ────────────────────────────────────────────────────────
echo ""
case "$ACTION" in
    plan)
        echo "Running terraform plan..."
        terraform plan -out=tfplan
        ;;
    apply)
        echo "Running terraform plan..."
        terraform plan -out=tfplan

        echo ""
        read -rp "Apply this plan? (yes/no): " CONFIRM
        [[ "$CONFIRM" != "yes" ]] && { echo "Aborted."; exit 0; }

        echo ""
        echo "Applying plan..."
        terraform apply tfplan

        echo ""
        echo "========================================"
        echo "  Deployment Complete!"
        echo "========================================"

        echo ""
        echo "Generating backend .env file..."
        terraform output -raw backend_env_file > "../src/backend/.env"
        echo "Written to: src/backend/.env"

        echo ""
        echo "Key Resources:"
        echo "  Backend URL:  $(terraform output -raw backend_url)"
        echo "  Frontend URL: $(terraform output -raw frontend_url)"
        echo "  PostgreSQL:   $(terraform output -raw postgres_server_fqdn)"
        echo "  Key Vault:    $(terraform output -raw key_vault_uri)"
        ;;
    destroy)
        echo "WARNING: This will DESTROY all Azure resources!"
        read -rp "Type 'destroy' to confirm: " CONFIRM
        [[ "$CONFIRM" != "destroy" ]] && { echo "Aborted."; exit 0; }
        terraform destroy
        ;;
    output)
        terraform output
        ;;
    *)
        echo "Unknown action: $ACTION. Use: apply, plan, destroy, output"
        exit 1
        ;;
esac
