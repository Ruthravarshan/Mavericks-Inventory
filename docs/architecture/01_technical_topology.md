graph TB
  subgraph Public["Public Internet"]
    Browser["Browser<br/>(React 19 + Vite)"]
    FE["Azure Static Web Apps<br/>(Frontend UI)"]
  end

  subgraph VNet["Virtual Network (10.0.0.0/16)"]
    subgraph SNetApp["snet-appservice (10.0.2.0/24)"]
      API["Azure App Service (Linux B1)<br/>Express API (Node 24) & node-cron"]
    end

    subgraph SNetPE["snet-endpoints (10.0.1.0/24)"]
      PE["Private Endpoints<br/>(Private DNS Zones)"]
    end
  end

  subgraph PrivateAzure["Isolated Azure Services (Public Access Disabled)"]
    PG["PostgreSQL 16 Flexible Server<br/>(mavericks_inventory)"]
    Blob["Azure Blob Storage<br/>(uploads, templates, reports)"]
    Search["Azure AI Search<br/>(mavericks-stocks)"]
    OpenAI["Azure OpenAI<br/>(GPT-4o)"]
    KV["Azure Key Vault<br/>(Secrets)"]
  end

  %% Flow
  Browser -->|HTTPS| FE
  Browser -->|REST API / Bearer JWT| API
  API -->|VNet Integration| SNetApp
  SNetApp -->|Internal Routing| SNetPE
  
  %% Private Link Connections
  SNetPE -->|Private Link| PG
  SNetPE -->|Private Link| Blob
  SNetPE -->|Private Link| Search
  SNetPE -->|Private Link| OpenAI
  SNetPE -->|Private Link| KV

  %% Managed Identity
  API -.->|System Assigned<br/>Managed Identity| KV

  %% Styling
  classDef azure fill:#0078D4,color:#fff,stroke:#005a9e,stroke-width:2px
  classDef app fill:#107c10,color:#fff,stroke:#054b05,stroke-width:2px
  classDef client fill:#744da9,color:#fff,stroke:#512878,stroke-width:2px
  classDef vnet fill:#f3f2f1,color:#333,stroke:#605e5c,stroke-dasharray: 5 5
  classDef pe fill:#ffb900,color:#000,stroke:#d83b01,stroke-width:2px

  class FE,API app
  class PG,Blob,Search,OpenAI,KV azure
  class Browser client
  class PE pe
  class VNet,SNetApp,SNetPE vnet
