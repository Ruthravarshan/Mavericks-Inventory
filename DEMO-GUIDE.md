# Mavericks Inventory — Demo Guide

> Prepared for demo walkthrough. Covers the use case, every page, every sub-tab, all workflows, and the AI/automation story.

---

## 1. What the application is (the use case)

**Mavericks Inventory** is an **AI-assisted IT inventory & asset management platform** for an enterprise/government IT department. It does two related jobs in one system:

1. **Stock / consumable inventory** — managing bulk stock (servers, peripherals, licenses, stationery, IT equipment) through a controlled **distribution → approval → ledger** pipeline with a Maker-Checker (L1/L2) governance model.
2. **Individual IT asset lifecycle** — tracking physical assets (laptops, monitors, phones, access cards, software licenses) from **request → approval → assignment → audit → return/retire**, including AI-verified photo audits.

The platform's differentiator is **autonomous governance powered by AI**:
- AI **risk-scores** every distribution and recommends Approve / Review / Reject.
- Low-risk requests are **zero-touch auto-approved** — no human needed.
- A background **anomaly engine** continuously watches stock health and raises alerts.
- AI **self-heals** messy bulk uploads (auto-corrects bad data).
- Natural-language **"Ask Inventory"** lets staff query data in plain English.

**Tech:** React 19 + Vite + Tailwind frontend · Node/Express + TypeScript + Drizzle/PostgreSQL backend · Azure OpenAI (GPT-4o), Azure AI Search, Azure Blob Storage. All Azure services have graceful rule-based fallbacks, so the demo works even if Azure is offline.

### The 6 roles (and what they're for)
| Role | Login (demo) | What they do |
|------|------|------|
| **Employee** (`user`) | employee@example.com | Requests assets, views own inventory, submits photo audits |
| **Executive** | exec@example.com | Self-service like an employee + can create distributions & view them |
| **Manager** (L1) | manager@example.com | First-level approver, manages stock, employees, requests, analytics |
| **Management Authority** (L2) | l2@example.com | Final/exception approver for high-value or escalated items |
| **System Admin** | admin@example.com | Full system config, users, access control, legal holds, reconciliation |
| **Auditor** | *(role exists, read-only)* | Read-only audit & compliance view |

All demo accounts use password **`DemoPass!123`**. On login, employees/execs land on **My Inventory**; manager/L2/admin land on the **Dashboard**.

---

## 2. The big picture — two core workflows

### A. Stock Distribution (Maker-Checker governance)
```
Create Distribution (draft)
   → Submit  → AI Risk Analysis runs → stock RESERVED
      → L1 (Manager) review
          • Low risk & qty ≤ 50 & not "Server"  → APPROVED instantly (zero-touch eligible)
          • qty > 50  OR  category = Server      → escalates to L2
      → L2 (Management Authority) review → APPROVED / REJECTED
   → On approval: stock DECREMENTED + immutable Ledger entry written
   → On rejection: reserved stock RELEASED, can be resubmitted
```
Key thresholds: **L2 required when qty > 50 or category = "Server"**. SLA = 48h.

### B. IT Asset Request (employee self-service)
```
Employee creates Request (AI suggests priority)  →  status: pending
   → Manager Approves / Rejects                  →  approved / rejected
   → Manager Fulfills (picks a physical asset)    →  fulfilled  (asset → "assigned")
   → 90-day audit reminder auto-created
   → Employee submits photo audit → AI verifies condition & tag
   → Asset eventually Returned / Retired
```

---

## 3. Page-by-page reference (with every sub-tab)

### 🔐 Login
- Email/password sign-in with show/hide toggle.
- **QUICK ACCESS** demo cards auto-fill any of the 5 roles — great for fast demo role-switching.
- Routes by role after login (assets vs dashboard).

---

### 📊 Dashboard — *role-aware command center* (no tabs; content changes by role)
- **Executive/Employee view:** "Your distribution overview" — KPI cards (My Distributions, Pending, Approved, Rejected), Stock Availability bar chart, Recent Activity feed.
- **Manager / L2 view:** "Approval queue at a glance" — big Pending Approvals hero card with avg processing time, Active/Critical Anomaly cards, Stock Health pie, Available vs Required line chart, Distribution Trend area chart.
- **Admin view:** "Operations under control" — Total Users/Stocks, Pending Approvals, Active Anomalies, Distribution-by-status pie, Top Distributed Items, and an **Approval Bottlenecks (>48h)** panel + live system activity.

> Demo tip: log in as manager to show the approval-centric dashboard, then as admin to show the system-health one.

---

### ✅ Approvals — *Approval Workbench* (the AI showpiece)
Sub-tabs (via `?tab=`):
- **Pending Queue** (default) — cards with **AI risk badge** (Low/Med/High/Critical), **AI recommendation chip** (Approve/Review/Reject), AI confidence %, SLA progress bar. Actions: **Approve / Reject / Forward to L2** (L1) or **Approve / Reject / Escalate back** (L2). **Bulk Approve** is enabled only when all selected are low-risk (zero-touch). Filters: risk, type, sort by age/risk; search.
- **Approval History** — all approved/rejected decisions (L2 sees "Override History").
- **Zero-Touch Log** (L2 only) — low-risk items auto-cleared by AI with a ⚡ "Auto-approved" pill, no manual review.

**Detail slide-out panel** shows: approval chain (Submitted → L1 → L2 → Approved), full AI analysis with risk factors, stock balance before/after, requester history, SLA status, remarks box (required on reject).

> Demo tip: This is the strongest screen. Show an AI "Approve" recommendation, bulk-approve low-risk items, then open a high-risk one and forward to L2.

---

### ⚠️ Anomalies — *AI anomaly detection*
Sub-tabs: **All · Critical · Warning · Info**.
- Summary cards (Critical/Warning/Info counts), "Show/Hide resolved" toggle.
- Each card: severity, stock, AI explanation (expandable), recommended action.
- Lifecycle actions: **Acknowledge → Mark as Resolved** (notes required) or **Dismiss** (confirmation, logged).
- Anomaly types detected by the engine: **zero_stock, low_stock, velocity_anomaly, frequency_anomaly, volume_anomaly** (see §4).

---

### 🧠 AI Insights — *natural-language analytics*
One page, two sections:
- **Inventory Health Assessment** — AI health score 0–100 (color-coded), summary, key observations, recommended actions; refreshable.
- **Ask Inventory** — type questions in plain English (or use 6 suggested queries like "Which items are below minimum stock level?"). Returns an answer, confidence %, and a data table. Keeps session query history.

---

### 📦 Stock Master (Stocks)
Lifecycle sub-tabs: **Draft · Active · Inactive** (each with count badge).
- Create/Edit stock (with AI stock-code generation + AI category classification suggestion), search (typo-tolerant), filter by category/criticality/UOM.
- Bulk: Request Activation (draft) / Deactivate (active).
- Row actions vary by tab: activate, deactivate, reactivate, version history, delete.
- Click stock code → **Movement History** side panel (in/out/adjustment timeline).
- **Quantity mini-chart** per row (Available/Reserved) → expands to Opening / Distributed / Reserved / Available breakdown.

**Stock Detail page** (click a stock): 4 stat cards (Available, Total, Distributed, Utilization %), stock info, stock-level indicator vs min/max, full transaction ledger.

---

### 🔁 Distributions
- Table of all distribution requests: code, stock, qty, recipient, date, **status badge**, **risk badge**, **AI recommendation**.
- Filters: status (Draft/Submitted/L1 Pending/L2 Pending/Approved/Rejected), risk; search.
- Row click → detail modal with **AI Risk Assessment** + **Approval History timeline**.
- **+ New Distribution** → creation workflow.

**New Distribution workflow** (single scrollable form, 3 sections):
1. **Stock Selection** — search stock, see available qty; warns if requested qty exceeds available ("will be flagged high risk").
2. **Recipient Info** — Employee or Project, ID, name.
3. **Distribution Details** — date, location, purpose (min 10 chars).
→ **Save as Draft** or **Submit for Approval** (triggers AI risk analysis + reserves stock).

---

### 📒 Stock Ledger — *immutable audit trail*
- Read-only log of every approved movement. Stat cards: Total Movements, Stock In, Stock Out, Net Movement.
- Type filter pills: All / Stock In / Stock Out / Adjustment. Search + **Export to CSV**. Paginated.
- Columns: txn code, type, stock, qty change (±), balance before/after, actor, remarks, date.

---

### 🏷️ Asset Registry (Assets)
- Tracks individual IT assets. Stat cards: Total, Available, Assigned, Maintenance/Retired.
- Status pills: All / Available / Assigned / Maintenance / Retired / Lost. Filter by category; search by tag/model/serial.
- **+ Add Asset**, **Assign** (pick employee + validity date), **Return to inventory**.
- Row click → detail side-panel: identity, procurement (purchase date, warranty, price, invoice), current assignee, next audit due, notes.

---

### ♻️ Reconciliation *(Admin only)*
- Physical-count vs system-count comparison. Stat cards: Matched / Variances / Draft Adjustments / Count Pending.
- **Import Count Sheet** (CSV: stock_code, physical_qty), **Run Reconciliation**, enter counts inline.
- Variance rows → **Create Adjustment**; draft adjustments → **Approve**. Detail panel per stock.

---

### 👥 Employees
- Searchable, department-filterable grid of employees with avatar, department, location, ID, and asset-count badge.
- Click → **Employee Detail**: hero with stats (Active Assets, Audit Overdue, Expiring Soon), **Currently Assigned** assets and **Past Assignments**, each with condition/validity/warranty/audit dates.

---

### 📥 Asset Requests (Manage Requests) *(Manager/Admin)*
- Status filter: All / Pending / Approved / Fulfilled / Rejected. Stat cards for each.
- Expandable request cards → **Approve** (optional notes) / **Reject** (reason required) / **Fulfill** (pick available asset + validity date → assigns it and marks fulfilled).

---

## 4. Employee self-service pages

### 💻 My Inventory (My Assets)
Sub-tabs: **My Assets · My Requests · My Audits**.
- **My Assets** — assigned asset cards with condition, validity ("Expires in Xd"/"Expired"), audit status ("Due in Xd"/"Overdue"), per-asset **Submit Audit** button. Top stats: Total / Expiring / Overdue / Expired.
- **My Requests** — request cards with a progress stepper (Submitted → Under Review → Decision → Fulfilled), status & priority badges, manager notes, timeline.
- **My Audits** — submitted audits with **AI processing status** (pending/verified/flagged/lost/damaged), AI confidence %, AI observations, reviewer notes.

### ➕ Create Request (Make Request)
1. **Asset selection** — category → AI-populated sub-category.
2. **Details** — what you need + why (justification).
3. **AI priority suggestion** — analyzes the justification text and recommends Low/Normal/Urgent/Critical with matched keywords; user can Apply or override.
4. Shows "what happens next" (L1 approver → fulfillment → notifications).
→ Submit → success screen with request code.

### 📋 My Requests
Dedicated tracker with status filter chips (All/Pending/Approved/Fulfilled/Rejected) and the same lifecycle stepper cards.

### 📷 Submit Audit (Asset Audit) — *AI photo verification, anti-tamper*
1. Select asset → 2. Select audit type (**Self / Scheduled / Renewal / Spot Check**) →
3. Capture mode: **This Device** (live camera, no uploads allowed) **or Scan with Phone** (generates a QR code) →
4. **Live capture** with a timestamp watermark burned into the image (anti-tampering) →
5. Optional notes → **Submit** → AI analyzes the photo (verifies asset tag, checks condition, matches records).

### 📱 Mobile Audit (public, QR-based)
- No login. Opened by scanning the QR from the Submit Audit page (`?t=token`).
- Live-camera-only capture with the same watermark → uploads photo back to the desktop audit session automatically.

### 👤 Profile
- View profile info; **Change Password** (current + new + confirm, min 8 chars).

---

## 5. Reports, audit & admin

### 📈 Reports
Left-sidebar report picker (8 reports): Current Stock Availability · Stock Distribution History · Pending Approvals · Approval History · Stock Movement Ledger · Anomaly History · Rejection Analysis · **User Activity Log** *(admin only)*. Each: set filters → **Run Report** → **Export Excel / Export PDF**.

### 📝 Audit Log
- System-wide event trail. Search + filter by event type (login, stock created/updated/deleted, distribution submitted/approved/rejected, anomaly detected/resolved, upload, user created/deactivated) and date range. Columns: timestamp, actor+role, event badge, description, entity, IP. Paginated 50/page.

### ⬆️ Bulk Upload
Tabs: **Stock Master Upload · Distribution Upload**.
- Drag/drop XLSX/CSV → **Download Template** / **Upload File** → real-time progress.
- Result card: Total / Saved / **Auto-Corrected** / Failed, plus an **AI Self-Healing Corrections** list (original → corrected + reason) and an Errors list. Upload history table below.

### ⚙️ System Admin *(Admin only)* — 8 tabs
1. **Users** — add user, search, activate/deactivate, roles.
2. **Access Control** — per-role toggle of which sidebar items are visible (saved, applies on next login).
3. **Catalog** — manage Stock Categories, Units of Measure, Locations.
4. **System Health** — service status + response times, key counts, **Approval Bottlenecks (>48h)** alert.
5. **Configuration** — L2 qty threshold, anomaly sensitivity, L1/L2 SLA hours, session timeout.
6. **AI Policy** — anomaly sensitivity + status of the 5 AI features (all active).
7. **Workflows** — approval routing rules + the 5 workflow stages (Draft → L1 → L2 → Approved/Rejected).
8. **Monitoring** — live key metrics + system services.

### 🔒 Legal Holds *(create/release = Admin)*
- Lock records for compliance/litigation. Stats: Active Holds / Records Locked / Released. **New Legal Hold** (title, case number, scope = Transactions/Stock Master/User Records, reason). Filter All/Active/Released; expand to **View Locked Records** / **Release Hold**.

---

## 6. The AI / automation story (talking points)

**Four AI agents (Azure OpenAI GPT-4o, all with rule-based fallback):**
1. **Risk Analysis Agent** — scores each distribution 0–100, returns risk level + Approve/Review/Reject + reasoning + confidence + flags. Drives approval routing & zero-touch.
2. **Data Self-Healing Agent** — validates & auto-corrects bulk-upload rows (e.g. "Electronics → IT Equipment") and reports per-row errors.
3. **Anomaly Explanation Agent** — turns each detected anomaly into a plain-English explanation + recommended action + urgency.
4. **Health Narrative Agent** — writes the executive Inventory Health summary, observations, and recommended actions.

**Anomaly engine** (background, rule-based + AI explanations) runs 4 checks:
- **Low/Zero stock** (below min, or 0) — warning/critical
- **Velocity** (>50% depleted in 7 days) — warning, critical if >80%
- **Frequency** (same recipient + item >3× in 30 days) — warning
- **Volume** (single request >2× the item's average) — warning, critical if >3×
New anomalies notify all managers/L2/admins.

**Separate Agent service** (`src/agent`, port 9090) — a read-only **RAG Q&A microservice**: Azure AI Search retrieves top-5 inventory docs, GPT-4o answers grounded in them, returns answer + sources + confidence (high/med/low). Powers natural-language inventory questions.

**Zero-touch automation** — low-risk distributions can be bulk auto-approved without human review; AI-driven escalation routes only the risky ones to humans.

---

## 7. Suggested demo flow (10–12 min)

1. **Login screen** → mention 5 roles, click demo cards (30s).
2. **Employee:** Create Request → show **AI priority suggestion**; submit; then **Submit Audit** with live-camera watermark + QR-to-phone (2–3 min).
3. **Manager:** Dashboard (approval-centric) → **Approvals Workbench**: show AI risk + recommendation, **Bulk Approve** low-risk (zero-touch), forward a high-risk to L2; check **Anomalies** (3–4 min).
4. **L2:** approve the escalated item; show **Zero-Touch Log** (1 min).
5. **AI Insights:** ask a plain-English question + health score (1 min).
6. **Bulk Upload:** upload a messy file → show **AI self-healing corrections** (1–2 min).
7. **Admin:** System Admin → Access Control + Configuration; Legal Holds; Reports → export (1–2 min).

**Closing line:** "Every state change is risk-scored by AI, governed by a Maker-Checker L1/L2 workflow, continuously watched by an anomaly engine, and recorded in an immutable ledger — so the system largely runs itself and only escalates exceptions to humans."
</content>
</invoke>
