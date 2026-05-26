sequenceDiagram
  autonumber
  actor U as User
  participant FE as React Frontend
  participant API as Express API
  participant DB as PostgreSQL
  participant OAI as Azure OpenAI
  participant Blob as Blob Storage
  participant Search as AI Search

  %% Authentication
  rect rgb(240, 248, 255)
  note over U,DB: 1. Authentication (Login)
  U->>FE: Enter credentials
  FE->>API: POST /api/v1/auth/login
  API->>DB: SELECT user BY email
  DB-->>API: User record + hashed_password
  API->>API: bcrypt.compare()
  API->>API: jwt.sign(userId, role)
  API-->>FE: 200 OK { token, user }
  FE->>FE: Store token in memory / context
  end

  %% Distribution Approval
  rect rgb(255, 245, 238)
  note over U,DB: 2. Distribution Request & Approval
  U->>FE: Request 5 Laptops (Viewer)
  FE->>API: POST /api/v1/distribution (Bearer Token)
  API->>API: RBAC: check role (Viewer allowed)
  API->>DB: INSERT distribution_request (status=pending)
  DB-->>API: Request ID
  API-->>FE: 201 Created

  U->>FE: Review requests (Manager)
  FE->>API: GET /api/v1/distribution?status=pending
  API-->>FE: List of requests
  U->>FE: Click "Approve"
  FE->>API: PUT /api/v1/distribution/:id/approve
  API->>DB: BEGIN TX
  API->>DB: UPDATE request SET status='approved'
  API->>DB: UPDATE inventory SET quantity = quantity - 5
  API->>DB: COMMIT TX
  API-->>FE: 200 OK
  end

  %% NLQ Query
  rect rgb(245, 255, 250)
  note over U,OAI: 3. Natural Language Query (NLQ)
  U->>FE: "Show me laptops with <10 stock"
  FE->>API: POST /api/v1/ai/query { text }
  API->>OAI: Convert text to PostgreSQL SQL query
  OAI-->>API: "SELECT * FROM inventory WHERE..."
  API->>DB: Execute AI-generated SQL (Read-Only)
  DB-->>API: Query Results
  API->>OAI: Summarize results in human language
  OAI-->>API: "You have 2 laptop models running low..."
  API-->>FE: { data, summary }
  FE-->>U: Display charts & summary
  end

  %% Bulk Upload
  rect rgb(253, 245, 230)
  note over U,Search: 4. Async Bulk Upload & Self-Heal
  U->>FE: Upload inventory.xlsx
  FE->>API: POST /api/v1/upload (multipart/form-data)
  API->>API: Multer: validate ext=xlsx, size<10MB
  API->>Blob: Upload file stream
  Blob-->>API: Blob URL
  API->>DB: INSERT uploadJob { status: queued, blobUrl }
  API-->>FE: 202 { jobId }
  FE->>FE: Start polling /upload/:jobId/status

  Note over API: setImmediate -> background processing

  API->>Blob: Download file bytes
  Blob-->>API: File buffer
  API->>API: XLSX.parse rows
  API->>OAI: Self-heal validation prompt (rows batch)
  OAI-->>API: Healed rows + error flags
  API->>DB: Batch INSERT stocks (onConflictDoNothing)
  API->>Search: Index new stock documents (parallel)
  API->>DB: UPDATE uploadJob { status: completed, successCount, errorCount }

  alt Errors present
    API->>API: Generate error XLSX
    API->>Blob: Upload error report
    Blob-->>API: Error report URL
    API->>DB: UPDATE uploadJob { errorReportUrl }
  end

  FE->>API: GET /upload/:jobId/status
  API-->>FE: { status: completed, successCount, errorCount }
  FE-->>U: Show results + download error report link
  end
