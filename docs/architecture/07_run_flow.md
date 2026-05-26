flowchart TD
  Start(["Node 24 Process<br/>Starts"]) --> EnvLoad

  subgraph Startup["Startup Sequence"]
    EnvLoad["Load .env /<br/>Azure App Settings"]
    KVSecrets["Read secrets from Key Vault<br/>(via Managed Identity)"]
    DBConn["Establish PostgreSQL<br/>Connection Pool<br/>(max 20 connections)"]
    BlobInit["Initialize Azure<br/>Blob Service Client"]
    SearchInit["Initialize Azure<br/>AI Search Client"]
    OAIInit["Initialize Azure<br/>OpenAI Client"]
    MWSetup["Register Express<br/>Middleware Stack"]
    RouteMount["Mount API Routes<br/>/api/v1/*"]
    CronStart["Start node-cron<br/>Anomaly Scheduler<br/>(*/15 * * * *)"]
    Listen["Listen on PORT 8080<br/>(or $PORT env)"]

    EnvLoad --> KVSecrets --> DBConn --> BlobInit --> SearchInit --> OAIInit --> MWSetup --> RouteMount --> CronStart --> Listen
  end

  Listen --> RequestCycle

  subgraph RequestCycle["Request Lifecycle (per HTTP request)"]
    Receive["Receive HTTP<br/>Request"]
    CORS_MW["CORS Check"]
    RateLimit_MW["Rate Limiter<br/>(general / upload / AI)"]
    Logging_MW["Pino HTTP Logger<br/>(redacts auth headers)"]
    Auth_MW["JWT Auth Middleware<br/>verify Bearer token"]
    RBAC_MW["RBAC guard<br/>check role permissions"]
    RouteHandler["Route Handler<br/>(business logic)"]
    DBQuery["Drizzle ORM<br/>-> PostgreSQL query"]
    CacheCheck["In-Memory Cache<br/>check (5-min TTL)"]
    ExtCall["External Service<br/>call if needed"]
    Response["Send JSON Response<br/>+ set headers"]

    Receive --> CORS_MW --> RateLimit_MW --> Logging_MW --> Auth_MW --> RBAC_MW --> RouteHandler
    RouteHandler --> CacheCheck
    CacheCheck -->|Hit| Response
    CacheCheck -->|Miss| DBQuery --> ExtCall --> Response
  end

  subgraph BackgroundWork["Background Work"]
    CronFire["Cron fires<br/>every 15 min"]
    AnomalyRun["runAnomalyDetection()"]
    AnomalyChecks["Parallel checks:<br/>low stock, velocity<br/>frequency, volume"]
    AIExplain["Azure OpenAI<br/>explain + recommend<br/>(cached)"]
    InsertAnom["INSERT anomaly<br/>records + notifications"]

    CronFire --> AnomalyRun --> AnomalyChecks --> AIExplain --> InsertAnom
  end

  subgraph UploadWork["Upload Background Work"]
    JobQueued["Upload Job<br/>(status: queued)"]
    SetImmediate["setImmediate()<br/>Defer to event loop"]
    ParseXLSX["Parse XLSX<br/>rows in memory"]
    SelfHeal["AI Self-Heal<br/>validation (GPT-4o)"]
    BatchInsert["Batch INSERT<br/>+ Search index"]
    UpdateJob["UPDATE uploadJob<br/>(completed / errors)"]

    JobQueued --> SetImmediate --> ParseXLSX --> SelfHeal --> BatchInsert --> UpdateJob
  end

  CronStart -.-> CronFire
  RouteHandler -.->|Upload route| JobQueued

  subgraph Observability["Observability"]
    PinoLog["Pino Structured Logs<br/>(stdout / file)"]
    ActivityDB["Activity Log<br/>INSERT to DB"]
    HealthzEP["GET /healthz<br/>(no auth, returns status)"]
  end

  Response --> PinoLog
  RouteHandler -.->|auth/approval/upload events| ActivityDB

  classDef startup fill:#0078D4,color:#fff,stroke:none
  classDef request fill:#107c10,color:#fff,stroke:none
  classDef background fill:#ca5010,color:#fff,stroke:none
  classDef obs fill:#744da9,color:#fff,stroke:none
  classDef terminal fill:#005a9e,color:#fff,stroke:none

  class EnvLoad,KVSecrets,DBConn,BlobInit,SearchInit,OAIInit,MWSetup,RouteMount,CronStart,Listen startup
  class Receive,CORS_MW,RateLimit_MW,Logging_MW,Auth_MW,RBAC_MW,RouteHandler,DBQuery,CacheCheck,ExtCall,Response request
  class CronFire,AnomalyRun,AnomalyChecks,AIExplain,InsertAnom background
  class JobQueued,SetImmediate,ParseXLSX,SelfHeal,BatchInsert,UpdateJob background
  class PinoLog,ActivityDB,HealthzEP obs
  class Start terminal
