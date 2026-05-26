stateDiagram-v2
  %% Distribution Approval Flow
  state "Distribution Approval Flow" as DistFlow {
    [*] --> Requested: Viewer requests items
    Requested --> PendingReview: System notifies Manager
    PendingReview --> Approved: Manager approves
    PendingReview --> Rejected: Manager denies
    Approved --> Dispatched: Inventory deducted
    Dispatched --> [*]
    Rejected --> [*]
  }

  %% Anomaly Detection Flow
  state "Anomaly Detection Flow (Cron)" as AnomFlow {
    [*] --> Scan: Every 15 minutes
    Scan --> Analyze: Query recent stock changes
    Analyze --> CheckRules: Low stock? High velocity?
    CheckRules --> Anomalous: Trigger found
    CheckRules --> Normal: No trigger
    Normal --> [*]
    Anomalous --> AIReview: Send context to GPT-4o
    AIReview --> Flagged: Generate explanation
    Flagged --> Notify: Alert Manager
    Notify --> [*]
  }

  %% Bulk Upload Flow
  state "Bulk Upload Flow (Self-Healing)" as UploadFlow {
    [*] --> Upload: Manager uploads XLSX
    Upload --> Validate: Parse rows
    Validate --> ErrorFound: Missing fields / bad data
    Validate --> Clean: Data is valid
    Clean --> InsertDB: Save to PostgreSQL
    Clean --> IndexSearch: Add to AI Search
    InsertDB --> [*]
    IndexSearch --> [*]
    
    ErrorFound --> AIHeal: Send raw row to GPT-4o
    AIHeal --> Healed: GPT fixes data (e.g., extracts size)
    AIHeal --> Unrecoverable: GPT cannot fix
    Healed --> InsertDB
    Unrecoverable --> ErrorReport: Generate error.xlsx
    ErrorReport --> [*]
  }
