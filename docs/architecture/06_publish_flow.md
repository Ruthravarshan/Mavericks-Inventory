flowchart TD
  Dev(["Developer<br/>pushes to Git"]) --> GH["GitHub Repository<br/>(source of truth)"]

  GH --> TF_Plan

  subgraph IaC["Infrastructure (Manual / Terraform)"]
    TF_Plan["Plan / Review<br/>(review changes)"]
    TF_Apply["Apply / Provision<br/>(provision Azure resources)"]
    TF_Plan --> TF_Apply
  end

  TF_Apply --> RG

  subgraph Azure["Azure Private VNet Architecture (rg-mavericks-inventory-dev)"]
    RG["Resource Group<br/>rg-mavericks-inventory-dev"]
    
    RG --> VNet["Virtual Network<br/>vnet-mavericks-inventory-dev"]
    
    VNet --> SNetPE["snet-endpoints<br/>(Private Endpoints)"]
    VNet --> SNetApp["snet-appservice<br/>(VNet Integration)"]

    SNetPE --> PG["PostgreSQL 16<br/>Flexible Server"]
    SNetPE --> Blob["Azure Blob Storage<br/>(3 containers)"]
    SNetPE --> AISearch["Azure AI Search<br/>mavericks-stocks index"]
    SNetPE --> OpenAI["Azure OpenAI<br/>GPT-4o deployment"]
    SNetPE --> KV["Azure Key Vault<br/>Secrets provisioned"]

    SNetApp --> AppSvc["App Service<br/>Backend API"]
    RG --> ASP["App Service Plan<br/>Linux B1"]
    ASP --> AppSvc
    
    RG --> SWA["Static Web App<br/>Public Frontend"]
  end

  subgraph BackendDeploy["Backend Build & Deploy"]
    BE_Build["npm run build<br/>(tsc -> dist/)"]
    BE_Migrate["Jumpbox / VPN required<br/>drizzle-kit push"]
    BE_Deploy["az webapp deploy<br/>or GitHub Actions<br/>-> App Service"]
    BE_Build --> BE_Migrate --> BE_Deploy
  end

  subgraph FrontendDeploy["Frontend Build & Deploy"]
    FE_Env["Inject env vars<br/>VITE_API_URL etc."]
    FE_Build["npm run build<br/>(Vite -> dist/)"]
    FE_Deploy["swa deploy<br/>or GitHub Actions<br/>-> Static Web App"]
    FE_Env --> FE_Build --> FE_Deploy
  end

  KV -.->|Managed Identity<br/>App Settings| AppSvc
  AppSvc --> BE_Build
  SWA --> FE_Env
  BE_Deploy --> Live_API(["Live API<br/>https://app-*.azurewebsites.net"])
  FE_Deploy --> Live_FE(["Live Frontend<br/>https://stapp-*.azurestaticapps.net"])

  Live_FE -->|API calls| Live_API

  subgraph Env["Environments"]
    Dev_Env["dev<br/>(feature testing)"]
    Staging_Env["staging<br/>(QA / UAT)"]
    Prod_Env["prod<br/>(live traffic)"]
    Dev_Env --> Staging_Env --> Prod_Env
  end

  classDef terminal fill:#107c10,color:#fff,stroke:none
  classDef azure fill:#0078D4,color:#fff,stroke:none
  classDef build fill:#ca5010,color:#fff,stroke:none
  classDef env fill:#744da9,color:#fff,stroke:none
  classDef vnet fill:#f3f2f1,color:#333,stroke:#605e5c,stroke-dasharray: 5 5

  class Live_API,Live_FE terminal
  class PG,Blob,AISearch,OpenAI,KV,ASP,AppSvc,SWA,RG azure
  class BE_Build,BE_Migrate,BE_Deploy,FE_Env,FE_Build,FE_Deploy build
  class Dev_Env,Staging_Env,Prod_Env env
  class VNet,SNetPE,SNetApp vnet
