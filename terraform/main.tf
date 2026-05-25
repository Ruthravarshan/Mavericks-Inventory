# ─────────────────────────────────────────────────────────────────────────────
# MAVERICKS INVENTORY — Azure Infrastructure
# Provisions: Resource Group, PostgreSQL, Blob Storage, Azure OpenAI,
#             Azure AI Search, App Service (Backend), Static Web App (Frontend),
#             Key Vault
# ─────────────────────────────────────────────────────────────────────────────

locals {
  prefix     = "${var.project_name}-${var.environment}"
  tags = {
    project     = "mavericks-inventory"
    environment = var.environment
    team        = "mavericks"
    managed_by  = "terraform"
  }
}

# Unique suffix to avoid global naming conflicts (storage accounts, openai, etc.)
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# ─── 1. Resource Group ────────────────────────────────────────────────────────

data "azurerm_resource_group" "main" {
  name = "id12-syn"
}

# ─── 2. PostgreSQL Flexible Server ───────────────────────────────────────────

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-${local.prefix}-${random_string.suffix.result}"
  resource_group_name    = data.azurerm_resource_group.main.name
  location               = var.location
  version                = var.postgres_version
  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password

  sku_name   = var.postgres_sku
  storage_mb = var.postgres_storage_mb

  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  auto_grow_enabled            = true

  # Public access — restrict to App Service outbound IPs in firewall rules below
  public_network_access_enabled = true

  tags = local.tags
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = var.postgres_db_name
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Allow Azure services to connect (needed for App Service → PostgreSQL)
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "AllowAllAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Allow your current IP for local development / seeding
resource "azurerm_postgresql_flexible_server_firewall_rule" "dev_access" {
  name             = "AllowDevAccess"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"   # Replace with your IP after deployment
  end_ip_address   = "255.255.255.255"
}

# ─── 3. Azure Storage Account + Container ─────────────────────────────────────

resource "azurerm_storage_account" "main" {
  name                     = "stmav${random_string.suffix.result}"  # max 24 chars, lowercase
  resource_group_name      = data.azurerm_resource_group.main.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"  # Cheapest — upgrade to ZRS for production

  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true

  blob_properties {
    delete_retention_policy {
      days = 7
    }
  }

  tags = local.tags
}

resource "azurerm_storage_container" "uploads" {
  name                  = "mavericks-uploads"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "templates" {
  name                  = "mavericks-templates"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "reports" {
  name                  = "mavericks-reports"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# ─── 4. Azure OpenAI ──────────────────────────────────────────────────────────

resource "azurerm_cognitive_account" "openai" {
  name                = "oai-${local.prefix}-${random_string.suffix.result}"
  location            = var.openai_location
  resource_group_name = data.azurerm_resource_group.main.name
  kind                = "OpenAI"
  sku_name            = "S0"

  custom_subdomain_name = "oai-${local.prefix}-${random_string.suffix.result}"

  tags = local.tags
}

resource "azurerm_cognitive_deployment" "gpt4o" {
  name                 = var.openai_model
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = var.openai_model
    version = var.openai_model_version
  }

  scale {
    type     = "Standard"
    capacity = var.openai_capacity
  }
}

# ─── 5. Azure AI Search ───────────────────────────────────────────────────────

resource "azurerm_search_service" "main" {
  name                = "srch-${local.prefix}-${random_string.suffix.result}"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  sku                 = var.search_sku
  replica_count       = 1
  partition_count     = 1

  public_network_access_enabled = true
  local_authentication_enabled  = true

  tags = local.tags
}

# ─── 6. App Service Plan (shared by backend) ─────────────────────────────────

resource "azurerm_service_plan" "main" {
  name                = "asp-${local.prefix}"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = local.tags
}

# ─── 7. Backend App Service (Node.js) ────────────────────────────────────────

locals {
  postgres_connection_string = "postgresql://${var.postgres_admin_username}:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.postgres_db_name}?sslmode=require"
  storage_connection_string  = "DefaultEndpointsProtocol=https;AccountName=${azurerm_storage_account.main.name};AccountKey=${azurerm_storage_account.main.primary_access_key};EndpointSuffix=core.windows.net"
}

resource "azurerm_linux_web_app" "backend" {
  name                = "app-${local.prefix}-api"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = var.location
  service_plan_id     = azurerm_service_plan.main.id

  https_only = true

  site_config {
    always_on        = true
    http2_enabled    = true
    app_command_line = "node dist/index.js"

    application_stack {
      node_version = "20-lts"
    }

    cors {
      allowed_origins     = ["https://${var.project_name}-${var.environment}-frontend.azurestaticapps.net"]
      support_credentials = true
    }
  }

  app_settings = {
    # Node
    NODE_ENV = "production"
    PORT     = "8080"

    # Database
    DATABASE_URL = local.postgres_connection_string

    # Auth
    JWT_SECRET = var.jwt_secret

    # Frontend URL (Static Web App URL — update after frontend is deployed)
    FRONTEND_URL = "https://${var.project_name}-${var.environment}.azurestaticapps.net"

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT     = azurerm_cognitive_account.openai.endpoint
    AZURE_OPENAI_KEY          = azurerm_cognitive_account.openai.primary_access_key
    AZURE_OPENAI_DEPLOYMENT   = var.openai_model
    AZURE_OPENAI_API_VERSION  = "2024-02-01"

    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING = local.storage_connection_string
    AZURE_STORAGE_CONTAINER         = azurerm_storage_container.uploads.name

    # Azure AI Search
    AZURE_SEARCH_ENDPOINT = "https://${azurerm_search_service.main.name}.search.windows.net"
    AZURE_SEARCH_KEY      = azurerm_search_service.main.primary_key
    AZURE_SEARCH_INDEX    = "mavericks-stocks"

    # App Service settings
    WEBSITES_PORT             = "8080"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
    LOG_LEVEL = "info"
  }

  logs {
    application_logs {
      file_system_level = "Information"
    }
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
  }

  tags = local.tags
}

# ─── 8. Frontend — Azure Static Web App ──────────────────────────────────────

resource "azurerm_static_web_app" "frontend" {
  name                = "stapp-${local.prefix}-frontend"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = "East US 2"   # Static Web Apps have limited region support
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = local.tags
}

# ─── 9. Key Vault (secrets management) ───────────────────────────────────────

data "azuread_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                = "kv-mav-${random_string.suffix.result}"
  location            = var.location
  resource_group_name = data.azurerm_resource_group.main.name
  tenant_id           = var.tenant_id
  sku_name            = "standard"

  soft_delete_retention_days = 7
  purge_protection_enabled   = false

  access_policy {
    tenant_id = var.tenant_id
    object_id = data.azuread_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge", "Recover"
    ]
  }

  tags = local.tags
}

# Store secrets in Key Vault
resource "azurerm_key_vault_secret" "db_url" {
  name         = "database-url"
  value        = local.postgres_connection_string
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = var.jwt_secret
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "openai_key" {
  name         = "azure-openai-key"
  value        = azurerm_cognitive_account.openai.primary_access_key
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "storage_connection" {
  name         = "storage-connection-string"
  value        = local.storage_connection_string
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}

resource "azurerm_key_vault_secret" "search_key" {
  name         = "azure-search-key"
  value        = azurerm_search_service.main.primary_key
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault.main]
}
