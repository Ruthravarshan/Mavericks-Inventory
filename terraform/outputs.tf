# ─── Resource Group ───────────────────────────────────────────────────────────

output "resource_group_name" {
  description = "Name of the created resource group"
  value       = data.azurerm_resource_group.main.name
}

output "resource_group_location" {
  description = "Azure region"
  value       = data.azurerm_resource_group.main.location
}

# ─── PostgreSQL ───────────────────────────────────────────────────────────────

output "postgres_server_fqdn" {
  description = "PostgreSQL server hostname"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_server_name" {
  description = "PostgreSQL server name"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "postgres_database_name" {
  description = "Application database name"
  value       = azurerm_postgresql_flexible_server_database.app.name
}

output "database_url" {
  description = "Full PostgreSQL connection string (sensitive)"
  value       = "postgresql://${var.postgres_admin_username}:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.postgres_db_name}?sslmode=require"
  sensitive   = true
}

# ─── Storage ──────────────────────────────────────────────────────────────────

output "storage_account_name" {
  description = "Azure Storage Account name"
  value       = azurerm_storage_account.main.name
}

output "storage_connection_string" {
  description = "Azure Blob Storage connection string (sensitive)"
  value       = "DefaultEndpointsProtocol=https;AccountName=${azurerm_storage_account.main.name};AccountKey=${azurerm_storage_account.main.primary_access_key};EndpointSuffix=core.windows.net"
  sensitive   = true
}

output "storage_uploads_container" {
  description = "Blob container name for uploads"
  value       = azurerm_storage_container.uploads.name
}

# ─── Azure OpenAI ─────────────────────────────────────────────────────────────

output "openai_endpoint" {
  description = "Azure OpenAI endpoint URL"
  value       = azurerm_cognitive_account.openai.endpoint
}

output "openai_key" {
  description = "Azure OpenAI API key (sensitive)"
  value       = azurerm_cognitive_account.openai.primary_access_key
  sensitive   = true
}

output "openai_deployment_name" {
  description = "Azure OpenAI deployment name (model name)"
  value       = azurerm_cognitive_deployment.gpt4o.name
}

# ─── Azure AI Search ──────────────────────────────────────────────────────────

output "search_endpoint" {
  description = "Azure AI Search service endpoint"
  value       = "https://${azurerm_search_service.main.name}.search.windows.net"
}

output "search_primary_key" {
  description = "Azure AI Search admin key (sensitive)"
  value       = azurerm_search_service.main.primary_key
  sensitive   = true
}

output "search_service_name" {
  description = "Azure AI Search service name"
  value       = azurerm_search_service.main.name
}

# ─── Backend App Service ──────────────────────────────────────────────────────

output "backend_url" {
  description = "Backend App Service URL"
  value       = "https://${azurerm_linux_web_app.backend.default_hostname}"
}

output "backend_app_name" {
  description = "Backend App Service name (use for az webapp deploy)"
  value       = azurerm_linux_web_app.backend.name
}

# ─── Frontend Static Web App ──────────────────────────────────────────────────

output "frontend_url" {
  description = "Frontend Static Web App URL"
  value       = "https://${azurerm_static_web_app.frontend.default_host_name}"
}

output "frontend_deployment_token" {
  description = "Static Web App deployment token (for GitHub Actions)"
  value       = azurerm_static_web_app.frontend.api_key
  sensitive   = true
}

# ─── Key Vault ────────────────────────────────────────────────────────────────

output "key_vault_uri" {
  description = "Azure Key Vault URI"
  value       = azurerm_key_vault.main.vault_uri
}

output "key_vault_name" {
  description = "Azure Key Vault name"
  value       = azurerm_key_vault.main.name
}

# ─── .env file content ────────────────────────────────────────────────────────
# Run: terraform output -raw backend_env_file > ../src/backend/.env

output "backend_env_file" {
  description = "Complete .env file content for the backend — pipe to src/backend/.env"
  sensitive   = true
  value       = <<-ENV
DATABASE_URL=postgresql://${var.postgres_admin_username}:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${var.postgres_db_name}?sslmode=require
JWT_SECRET=${var.jwt_secret}
FRONTEND_URL=https://${azurerm_static_web_app.frontend.default_host_name}
PORT=8080
LOG_LEVEL=info
NODE_ENV=production

AZURE_OPENAI_ENDPOINT=${azurerm_cognitive_account.openai.endpoint}
AZURE_OPENAI_KEY=${azurerm_cognitive_account.openai.primary_access_key}
AZURE_OPENAI_DEPLOYMENT=${azurerm_cognitive_deployment.gpt4o.name}
AZURE_OPENAI_API_VERSION=2024-02-01

AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=${azurerm_storage_account.main.name};AccountKey=${azurerm_storage_account.main.primary_access_key};EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER=${azurerm_storage_container.uploads.name}

AZURE_SEARCH_ENDPOINT=https://${azurerm_search_service.main.name}.search.windows.net
AZURE_SEARCH_KEY=${azurerm_search_service.main.primary_key}
AZURE_SEARCH_INDEX=mavericks-stocks
  ENV
}
