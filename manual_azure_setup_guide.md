# Exhaustive Manual Azure Setup & Configuration Guide

Since you are bypassing Terraform and setting this up manually, this guide has been exhaustively expanded to include **every single toggle, configuration, firewall rule, and setting** defined in the original `main.tf` architecture. Nothing has been left out.

---

## 📋 Master List of Resource Names

| Resource Type | Recommended Region | Exact Name to Use |
| :--- | :--- | :--- |
| **Resource Group** | `East US` | `rg-mavericks-inventory-dev` |
| **Key Vault** | `East US` | `kv-mavericks-inv-dev` |
| **PostgreSQL Server** | `East US` | `psql-mavericks-inventory-dev` |
| **PostgreSQL Database**| `East US` | `mavericks_inventory` |
| **Azure OpenAI** | `East US` | `oai-mavericks-inventory-dev` |
| **Storage Account** | `East US` | `stmavericksinvdev` *(Max 24 chars, no hyphens)* |
| **AI Search** | `East US` | `srch-mavericks-inventory-dev` |
| **Static Web App (UI)**| `East US 2` | `stapp-mavericks-inventory-dev-frontend` |
| **App Service Plan** | `East US` | `asp-mavericks-inventory-dev` |
| **Backend Web App** | `East US` | `app-mavericks-inventory-dev-api` |

---

## 1. Resource Group & Key Vault
*   **Resource Group Name**: `rg-mavericks-inventory-dev` (Location: East US)
*   **Key Vault Name**: `kv-mavericks-inv-dev`
    *   **Pricing tier**: Standard
    *   **Soft-delete retention**: 7 days
    *   **Purge protection**: Disable
    *   **Access policy**: Ensure your user account has `Get, List, Set, Delete, Purge, Recover` permissions for Secrets.

---

## 2. Azure Database for PostgreSQL (Flexible Server)
*   **Resource Name**: `psql-mavericks-inventory-dev`
*   **Version**: `16`
*   **Workload type**: Development
*   **Compute Tier**: `Burstable B1ms`
*   **Storage**: `32 GB` (Auto-grow: Enabled)
*   **Backup**: Retention 7 days (Geo-redundancy: Disabled)
*   **Authentication**: PostgreSQL authentication only
*   **Admin Username**: `mavericksadmin`
*   **Admin Password**: `BsfXWNU1V1bk1MQ@`
*   **Networking / Firewall (CRITICAL)**: 
    *   Enable **Public access**.
    *   Check the box: **"Allow public access from any Azure service within Azure to this server"** (This allows the Backend Web App to connect).
    *   Click **+ Add current client IP address** (This allows your local machine to connect).
*   **Post-Deployment step (The Database)**:
    *   Navigate to **Databases** in the left menu.
    *   Add a new database named **`mavericks_inventory`**
    *   Collation: `en_US.utf8`
    *   Charset: `utf8`

---

## 3. Azure OpenAI Service
*   **Resource Name**: `oai-mavericks-inventory-dev`
*   **Pricing Tier**: `Standard S0`
*   **Custom subdomain**: `oai-mavericks-inventory-dev`
*   **Post-Deployment step (The Model)**:
    *   Go to Azure OpenAI Studio -> Deployments -> Create new deployment.
    *   **Model name**: `gpt-4o`
    *   **Model version**: `2024-08-06`
    *   **Deployment name**: `gpt-4o`
    *   **Capacity (Tokens per minute)**: Set to your desired limit (e.g., 10K or 50K depending on quota).

---

## 4. Azure Storage Account
*   **Resource Name**: `stmavericksinvdev`
*   **Performance / Redundancy**: `Standard` / `Locally-redundant storage (LRS)`
*   **Security Settings**:
    *   Minimum TLS version: `Version 1.2`
    *   Allow cross-tenant replication: `False` (if asked)
    *   Allow Blob public access: `False` (Disable anonymous access)
    *   Blob soft delete: Enable, set to `7 days`
*   **Post-Deployment step (Containers)**:
    *   Go to **Data storage** -> **Containers** and create exactly three private containers:
    *   `mavericks-uploads` (Access level: Private)
    *   `mavericks-templates` (Access level: Private)
    *   `mavericks-reports` (Access level: Private)

---

## 5. Azure AI Search
*   **Resource Name**: `srch-mavericks-inventory-dev`
*   **Pricing Tier**: `Basic` (or Free if available)
*   **Scale**: Replicas: 1, Partitions: 1
*   **Security**: Ensure `Public network access` is Enabled and `Role-based access control (RBAC)` is set to Both or API Keys (Local authentication enabled).

---

## 6. Frontend Static Web App
*   **Resource Name**: `stapp-mavericks-inventory-dev-frontend`
*   **Region**: `East US 2`
*   **Pricing Tier**: `Free`

---

## 7. App Service Plan & Backend Web App
*   **App Service Plan Name**: `asp-mavericks-inventory-dev`
*   **Operating System**: Linux
*   **Pricing Tier**: `Basic B1`
*   **Backend Web App Name**: `app-mavericks-inventory-dev-api`
*   **Runtime Stack**: `Node 20 LTS`
*   **Configuration Settings (CRITICAL for the backend to run)**:
    *   Go to **Settings** -> **Configuration** -> **General settings**.
    *   **HTTPS Only**: `On`
    *   **Always On**: `On`
    *   **HTTP version**: `2.0`
    *   **Startup Command**: `node dist/index.js`
*   **CORS (Cross-Origin Resource Sharing)**:
    *   Go to **API** -> **CORS**.
    *   Add your Frontend URL (from Step 6) to the allowed origins.
    *   Check the box for **Enable Access-Control-Allow-Credentials**.
*   **App Service Logs**:
    *   Go to **App Service logs**.
    *   Enable **Application Logging (Filesystem)** to `Information` level.
    *   Enable **Web server logging** (Quota: 35 MB, Retention: 7 days).

---

## 8. How to retrieve keys and setup your `.env` File

Once all the resources are created, you need to extract specific keys and URLs from the Azure Portal to connect your local code to the cloud resources. Create a file named `.env` in your `src/backend/` folder and use the instructions below to fill in the missing values.

### Step-by-Step Retrieval Guide:

**1. `FRONTEND_URL`**
*   Go to your Static Web App (`stapp-mavericks-inventory-dev-frontend`) in the Azure Portal.
*   On the **Overview** page, look for the **URL** on the right side.
*   Copy it (e.g., `https://gentle-bush-12345.azurestaticapps.net`).

**2. `AZURE_OPENAI_ENDPOINT` & `AZURE_OPENAI_KEY`**
*   Go to your Azure OpenAI resource (`oai-mavericks-inventory-dev`).
*   In the left menu under **Resource Management**, click on **Keys and Endpoint**.
*   Copy **KEY 1** (paste it for `AZURE_OPENAI_KEY`).
*   Copy the **Endpoint** (paste it for `AZURE_OPENAI_ENDPOINT`).

**3. `AZURE_STORAGE_CONNECTION_STRING`**
*   Go to your Storage Account (`stmavericksinvdev`).
*   In the left menu under **Security + networking**, click on **Access keys**.
*   Click the **Show** button next to `key1` **Connection string**.
*   Copy the entire connection string.

**4. `AZURE_SEARCH_ENDPOINT` & `AZURE_SEARCH_KEY`**
*   Go to your AI Search service (`srch-mavericks-inventory-dev`).
*   On the **Overview** page, copy the **Url** (paste it for `AZURE_SEARCH_ENDPOINT`).
*   In the left menu under **Settings**, click on **Keys**.
*   Copy the **Primary admin key** (paste it for `AZURE_SEARCH_KEY`).

### Your `.env` File Template:

Copy and paste this into `src/backend/.env`, replacing the `<PLACEHOLDERS>` with the values you just retrieved:

```env
# ─── DATABASE & APP CONFIG ──────────────────────────────────────────────
DATABASE_URL=postgresql://mavericksadmin:BsfXWNU1V1bk1MQ@@psql-mavericks-inventory-dev.postgres.database.azure.com:5432/mavericks_inventory?sslmode=require
JWT_SECRET=IxFVLtcBRAf67diFzM5QbhXK2CNCtUuh2PGKgD07ukF36_q1b29VTyXHrDR3fDqT
PORT=8080
LOG_LEVEL=info
NODE_ENV=development

# Paste the URL from Step 1
FRONTEND_URL=<YOUR_STATIC_WEB_APP_URL>

# ─── AZURE OPENAI ───────────────────────────────────────────────────────
# Paste the Endpoint and Key 1 from Step 2
AZURE_OPENAI_ENDPOINT=<YOUR_OPENAI_ENDPOINT>
AZURE_OPENAI_KEY=<YOUR_OPENAI_API_KEY>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-01

# ─── AZURE BLOB STORAGE ─────────────────────────────────────────────────
# Paste the Connection String from Step 3
AZURE_STORAGE_CONNECTION_STRING=<YOUR_STORAGE_CONNECTION_STRING>
AZURE_STORAGE_CONTAINER=mavericks-uploads

# ─── AZURE AI SEARCH ────────────────────────────────────────────────────
# Paste the Url and Primary admin key from Step 4
AZURE_SEARCH_ENDPOINT=<YOUR_AI_SEARCH_ENDPOINT>
AZURE_SEARCH_KEY=<YOUR_AI_SEARCH_KEY>
AZURE_SEARCH_INDEX=mavericks-stocks
```
