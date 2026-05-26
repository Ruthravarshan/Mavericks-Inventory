graph TD
  subgraph Presentation["Presentation (UI) Layer"]
    UI["React 19 + Vite Frontend<br/>Radix UI (Primitives)<br/>TailwindCSS (Styling)<br/>React Hook Form + Zod (Validation)"]
  end

  subgraph API["API Layer (Express.js)"]
    Router["Express Router<br/>(/api/v1)"]
    Auth["JWT Auth Middleware<br/>(Bearer Token)"]
    RBAC["RBAC Middleware<br/>(Role check)"]
    Controller["Controllers<br/>(Req/Res handling)"]
  end

  subgraph Logic["Business Logic Layer"]
    AuthSvc["Auth Service<br/>(Login, Register, Approvals)"]
    InvSvc["Inventory Service<br/>(CRUD, Stock Logic)"]
    UploadSvc["Upload Service<br/>(Bulk XLSX parsing)"]
    AISvc["AI Service<br/>(NLQ, Heal, Explain)"]
    AnomalySvc["Anomaly Service<br/>(Cron + Detection)"]
  end

  subgraph Data["Data Access Layer"]
    ORM["Drizzle ORM<br/>(Type-safe queries)"]
    Cache["In-Memory Map<br/>(AI response cache)"]
  end

  subgraph External["Isolated Infrastructure Services (Private VNet)"]
    PG["PostgreSQL 16 (Private Endpoint)<br/>(mavericks_inventory)"]
    Blob["Azure Blob Storage (Private Endpoint)<br/>(Excel uploads/reports)"]
    Search["Azure AI Search (Private Endpoint)<br/>(Stock Index)"]
    OAI["Azure OpenAI (Private Endpoint)<br/>(GPT-4o)"]
    KV["Azure Key Vault (Private Endpoint)<br/>(Managed Identity Secrets)"]
  end

  UI -->|REST HTTPS| Router
  Router --> Auth
  Auth --> RBAC
  RBAC --> Controller
  Controller --> AuthSvc
  Controller --> InvSvc
  Controller --> UploadSvc
  Controller --> AISvc
  Controller --> AnomalySvc

  AuthSvc --> ORM
  InvSvc --> ORM
  UploadSvc --> ORM
  AnomalySvc --> ORM

  AISvc --> Cache
  Cache -.->|Miss| OAI
  AISvc --> OAI

  UploadSvc --> Blob
  InvSvc --> Search
  UploadSvc --> Search
  AuthSvc -.-> KV

  ORM -->|VNet Integration| PG

  classDef layer fill:#f9f9f9,stroke:#333,stroke-width:2px;
  classDef ext fill:#0078D4,color:#fff,stroke:#005a9e;
  
  class Presentation,API,Logic,Data layer
  class PG,Blob,Search,OAI,KV ext
