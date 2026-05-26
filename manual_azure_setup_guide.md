# Exhaustive Manual Azure Setup Guide (Private VNet Architecture)

This guide provides the exact specifications for creating a **fully private, secure dev environment** in Azure. All backend resources (Database, Storage, Key Vault, AI services) will have public access completely disabled and will only be accessible via Private Endpoints inside a Virtual Network (VNet). Your App Service will use VNet Integration to securely communicate with these resources.

---

## 📋 Master List of Resource Names

| Resource Type | Recommended Region | Exact Name to Use |
| :--- | :--- | :--- |
| **Resource Group** | `East US` | `rg-mavericks-inventory-dev` |
| **Virtual Network** | `East US` | `vnet-mavericks-inventory-dev` |
| **Key Vault** | `East US` | `kv-mavericks-inv-dev` |
| **PostgreSQL Server** | `East US` | `psql-mavericks-inventory-dev` |
| **PostgreSQL Database**| `East US` | `mavericks_inventory` |
| **Azure OpenAI** | `East US` | `oai-mavericks-inventory-dev` |
| **Storage Account** | `East US` | `stmavericksinvdev` *(Max 24 chars, no hyphens)* |
| **AI Search** | `East US` | `srch-mavericks-inventory-dev` |
| **App Service Plan** | `East US` | `asp-mavericks-inventory-dev` |
| **Backend Web App** | `East US` | `app-mavericks-inventory-dev-api` |
| **Static Web App (UI)**| `East US 2` | `stapp-mavericks-inventory-dev-frontend` |

---

## 🏗️ REQUIRED CREATION ORDER

To ensure Private Endpoints and DNS resolve correctly, you **MUST** create resources in this exact order:
`Resource Group` → `VNet` → `Storage` → `Database` → `Key Vault` → `OpenAI` → `Search` → `App Service` → `Frontend`

---

## 1. Resource Group & Virtual Network (VNet)
You must establish the networking foundation first.

*   **Resource Group Name**: `rg-mavericks-inventory-dev`
*   **Virtual Network Name**: `vnet-mavericks-inventory-dev`
    *   **Address space**: `10.0.0.0/16`
    *   **Subnet 1**: `snet-endpoints` (`10.0.1.0/24`) — Used for all Private Endpoints.
    *   **Subnet 2**: `snet-appservice` (`10.0.2.0/24`) — Used exclusively for App Service VNet Integration. Delegate this subnet to `Microsoft.Web/serverFarms`.

---

## 2. Azure Storage Account (Private)
*   **Resource Name**: `stmavericksinvdev`
*   **Security Settings**:
    *   Enable **Disable public access and use private access**.
    *   Create a **Private Endpoint** mapped to the `snet-endpoints` subnet.
    *   Target sub-resource: `blob`.
    *   Integrate with Private DNS Zone: `privatelink.blob.core.windows.net`.
*   **Containers**: Create three private containers: `mavericks-uploads`, `mavericks-templates`, `mavericks-reports`.

---

## 3. Azure Database for PostgreSQL (Private)
*   **Resource Name**: `psql-mavericks-inventory-dev`
*   **Compute Tier**: `Burstable B1ms`
*   **Credentials**: 
    *   Admin Username: `mavericksadmin`
    *   Admin Password: `BsfXWNU1V1bk1MQ@` *(Note: URL-encode the `@` to `%40` in your connection string)*
*   **Networking / Firewall (CRITICAL)**: 
    *   **Disable** Public access completely.
    *   Set up a **Private Endpoint** mapped to the `snet-endpoints` subnet.
    *   Integrate with Private DNS Zone: `privatelink.postgres.database.azure.com`.
*   **Database**: Add a new database named **`mavericks_inventory`**.

---

## 4. Azure Key Vault (Private)
*   **Resource Name**: `kv-mavericks-inv-dev`
*   **Networking**: 
    *   **Disable public access**.
    *   Create a **Private Endpoint** in `snet-endpoints`.
    *   Integrate with Private DNS Zone: `privatelink.vaultcore.azure.net`.
*   **Access Policy**: Use **Azure Role-Based Access Control (RBAC)**. You will grant your App Service's Managed Identity access to this later.

---

## 5. Azure OpenAI Service (Private)
*   **Resource Name**: `oai-mavericks-inventory-dev`
*   **Networking**:
    *   Select **Selected Networks and Private Endpoints** or Disable public access.
    *   Create a **Private Endpoint** in `snet-endpoints`.
    *   Integrate with Private DNS Zone: `privatelink.openai.azure.com`.
*   **Model**: Deploy `gpt-4o` (or `gpt-4o-mini`).

---

## 6. Azure AI Search (Private)
*   **Resource Name**: `srch-mavericks-inventory-dev`
*   **Networking**:
    *   Endpoint connectivity: **Private**.
    *   Create a **Private Endpoint** in `snet-endpoints`.
    *   Integrate with Private DNS Zone: `privatelink.search.windows.net`.

---

## 7. App Service Plan & Backend Web App
*   **App Service Plan**: `asp-mavericks-inventory-dev` (Linux, Basic B1).
*   **Backend Web App Name**: `app-mavericks-inventory-dev-api` (Node 24).
*   **Networking (CRITICAL)**:
    *   Go to **Networking** -> **VNet integration**.
    *   Enable VNet integration and select the `snet-appservice` subnet you created earlier. Ensure **Route All** is enabled so all outbound traffic flows through the VNet.
*   **Identity (Managed Identity)**:
    *   Go to **Identity** -> **System assigned** and turn it **On**.
    *   *Now go back to your Key Vault, click Access Control (IAM), and assign the "Key Vault Secrets User" role to this Managed Identity.*
*   **Configuration & Secrets (App Settings)**:
    *   Instead of relying purely on `.env`, go to **Settings** -> **Environment variables** in the App Service and add your configurations here.
    *   Store sensitive values (like `AZURE_OPENAI_KEY` or `DATABASE_URL`) in Key Vault and reference them in App Settings using the syntax: `@Microsoft.KeyVault(VaultName=kv-mavericks-inv-dev;SecretName=database-url)`.
*   **CORS**: Allow your exact Frontend URL (e.g., `https://stapp-mavericks-inventory-dev-frontend.azurestaticapps.net`).
*   **Startup**: `node dist/index.js` (Always On: True).

---

## 8. Frontend Static Web App (Public Ingress)
*   **Resource Name**: `stapp-mavericks-inventory-dev-frontend`
*   **Region**: `East US 2`
*   *Note: Static Web Apps cannot be fully private in the Free tier. It will act as the public-facing UI that securely talks to your App Service API, which in turn securely talks to your private backend resources.*

---

## Final Review
Because you are using a fully private VNet architecture, your local machine will **not** be able to connect directly to the Database, Storage, or OpenAI endpoints to run migrations unless you either:
1. Connect via a Point-to-Site VPN to the VNet.
2. Deploy a Jumpbox (Bastion VM) inside the VNet.
3. Temporarily whitelist your local IP on the specific resources during initial setup and seeding, then lock them back down to private endpoints only.
