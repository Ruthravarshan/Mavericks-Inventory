flowchart TD
  subgraph Users
    Admin(["Admin User"])
    Mgr(["Inventory Manager"])
    Viewer(["Viewer"])
  end

  subgraph System["Mavericks Inventory System"]
    UI["Web Interface<br/>(Dashboards, Tables, Uploads)"]
    API["API Gateway<br/>(Auth, Routing, Rate Limit)"]
    
    subgraph CoreModules["Core Modules"]
      AuthMod["Authentication & RBAC"]
      InvMod["Inventory Management<br/>(CRUD, Search)"]
      UploadMod["Bulk Upload Engine<br/>(XLSX Processing)"]
      ApproveMod["Approval Workflow<br/>(Distribution Requests)"]
    end

    subgraph AI["AI Layer"]
      Detect["Anomaly Detection<br/>(Rule-based + ML)"]
      SelfHeal["Self-Healing<br/>(Data Validation)"]
      NLQ["Natural Language Query<br/>(Ask questions about stock)"]
    end
  end

  Admin -->|Manage Roles / Global| UI
  Mgr -->|Upload / Approve / Edit| UI
  Viewer -->|Read / Request / NLQ| UI

  UI --> API
  API --> AuthMod
  API --> InvMod
  API --> UploadMod
  API --> ApproveMod

  UploadMod -->|Validate Rows| SelfHeal
  InvMod -->|Nightly/Hourly Scan| Detect
  UI -->|Chat / Search| NLQ
