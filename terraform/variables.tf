# ─── Azure Account ────────────────────────────────────────────────────────────

variable "tenant_id" {
  description = "Azure AD Tenant ID. Get it by running: az account show --query tenantId -o tsv"
  type        = string
}

variable "subscription_id" {
  description = "Azure Subscription ID. Get it by running: az account show --query id -o tsv"
  type        = string
}

# ─── Project ──────────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Short project identifier used as a prefix for all resource names"
  type        = string
  default     = "maverick"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "East US"
}

# ─── PostgreSQL ───────────────────────────────────────────────────────────────

variable "postgres_admin_username" {
  description = "PostgreSQL administrator username"
  type        = string
  default     = "mavericksadmin"
  sensitive   = false
}

variable "postgres_admin_password" {
  description = "PostgreSQL administrator password (min 8 chars, upper+lower+number+symbol)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_admin_password) >= 8
    error_message = "PostgreSQL password must be at least 8 characters."
  }
}

variable "postgres_db_name" {
  description = "Name of the application database"
  type        = string
  default     = "mavericks_inventory"
}

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU (Burstable = cheapest)"
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  description = "PostgreSQL storage in MB"
  type        = number
  default     = 32768 # 32 GB — minimum
}

variable "postgres_version" {
  description = "PostgreSQL major version"
  type        = string
  default     = "16"
}

# ─── App Service ──────────────────────────────────────────────────────────────

variable "app_service_sku" {
  description = "App Service Plan SKU (B1 = Basic, cheapest paid tier with always-on)"
  type        = string
  default     = "B1"
}

# ─── OpenAI ───────────────────────────────────────────────────────────────────

variable "openai_location" {
  description = "Azure region for OpenAI (must be a region where OpenAI is available)"
  type        = string
  default     = "East US"
}

variable "openai_model" {
  description = "GPT model to deploy"
  type        = string
  default     = "gpt-4o"
}

variable "openai_model_version" {
  description = "GPT model version"
  type        = string
  default     = "2024-05-13"
}

variable "openai_capacity" {
  description = "OpenAI deployment capacity (tokens per minute in thousands)"
  type        = number
  default     = 10
}

# ─── AI Search ────────────────────────────────────────────────────────────────

variable "search_sku" {
  description = "Azure AI Search SKU (free = 1 per subscription, basic = cheapest paid)"
  type        = string
  default     = "basic"
  validation {
    condition     = contains(["free", "basic", "standard"], var.search_sku)
    error_message = "Search SKU must be free, basic, or standard."
  }
}

# ─── JWT ──────────────────────────────────────────────────────────────────────

variable "jwt_secret" {
  description = "JWT signing secret for the backend (use a long random string)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "JWT secret must be at least 32 characters."
  }
}
