# Mavericks Inventory — Demo Script

A clean, present-from-this-file guide. Each section = **what the page does** + **exact demo steps**. Whenever you must switch accounts, it's called out in **bold** at the top of the step.

---

## 1. One-line pitch

> **Mavericks Inventory** is an AI-assisted IT inventory & asset platform. It governs stock with a Maker-Checker (L1/L2) approval workflow, manages the full IT-asset lifecycle (request → approve → assign → audit → return), and uses AI to risk-score approvals, detect anomalies, auto-correct bulk uploads, and answer questions in plain English.

---

## 2. Login accounts (all password: `DemoPass!123`)

> ⚠️ Type the email manually — use the addresses below.

| Role | Email | Use it to show |
|------|-------|----------------|
| **Employee** | `employee@mavericks.com` | Requesting assets, photo audits, acknowledging receipt |
| **Manager (L1)** | `manager@mavericks.com` | Approvals, anomalies, stock, reports, uploads |
| **L2 Authority** | `l2@mavericks.com` | Final approval of escalated/high-value items |
| **Admin** | `admin@mavericks.com` | System config, access control, reconciliation, legal holds |

**Demo order:** Employee → Manager → L2 → Admin. (Logout/login between acts; it's flagged in each act.)

---

# ACT 1 — Employee  🔐 Login as `employee@mavericks.com`

### Dashboard
**What it does:** Personal overview — your requests, assigned assets, quick actions.
**Steps:** Just point out the landing view, then go to the sidebar.

### Create Request  *(sidebar → Create Request)*
**What it does:** Raise an IT asset request. AI reads your justification and suggests a priority.
**Steps:**
1. Pick a **Category** (e.g. Laptop) → sub-category auto-fills.
2. Type what you need (e.g. "Dell Latitude laptop").
3. In **"Why do you need this?"**, type a justification with intent, e.g. *"My current laptop is broken and I cannot work."*
4. Watch the **AI suggest "Critical"** with the matched keywords — say *"the AI inferred urgency from the wording."*
5. (Optional) override the priority manually. **Submit** → note the request code.

### Submit Audit  *(sidebar → Submit Audit)*
**What it does:** Photo-verify an assigned asset. Live-capture only (no uploads) with a tamper-proof timestamp watermark; AI verifies it.
**Steps:**
1. Select an asset → choose **Self Audit**.
2. **This Device** → Open Camera → Capture (point at the asset tag). Show the **watermark** burned into the photo.
3. (Optional) show **Scan with Phone** → a QR code opens a live camera on the phone, photo flows back automatically.
4. **Submit** → it appears under **My Inventory → My Audits** with an AI status.

### My Requests  *(sidebar → My Requests)*
**What it does:** Tracks every request through Submitted → Review → Decision → Fulfilled, and lets you **acknowledge receipt** once fulfilled.
**Steps:**
1. Open a **Fulfilled** request (there's a seeded/earlier one, or come back after Act 2).
2. Click **"Acknowledge Receipt"** → it stamps **"Received"** and notifies the manager.

> 💡 If nothing is fulfilled yet, do this at the very end after the manager fulfills a request in Act 2.

---

# ACT 2 — Manager (L1)  🔐 Logout → Login as `manager@mavericks.com`

### Dashboard
**What it does:** Approval-centric command center — pending queue size, anomalies, stock health charts, and **Approval Bottlenecks (>48h)**.
**Steps:**
1. Show the big **Pending Approvals** card and the **Stock Health** + **Available vs Required** charts (Available = blue, Required = amber).
2. Click a row in **Approval Bottlenecks** → it **jumps straight to the Approval Workbench**, pre-filtered to that transaction.

### Approval Workbench ⭐  *(sidebar → Approval Workbench)*
**What it does:** The AI showpiece. Every distribution is risk-scored by AI with an Approve/Review/Reject recommendation. Low-risk items can be bulk-cleared (zero-touch); risky ones route to L2.
**Steps:**
1. Point out the **AI risk badge + recommendation + confidence** on each card, and the **SLA bar** (one item is SLA-breached).
2. Tick the **low-risk** items → **Bulk Approve** (zero-touch). 
3. On a single item, click **Approve** → a **confirmation dialog** appears (it no longer approves instantly) → **Confirm Approve**.
4. On the **high-value / qty>50** item, click **Forward to L2** with a reason — *"this escalates to the L2 authority."*
5. Tabs to mention: **Approval History** and **Zero-Touch Log**.

### Anomalies  *(sidebar → Anomalies)*
**What it does:** AI-detected stock-health issues (low/zero stock, unusual velocity/volume) with plain-English explanations.
**Steps:**
1. Show the tab **counts** on All / Critical / Warning / Info.
2. **Click a card** → a clean **detail view** opens with the full AI explanation and recommended action.
3. From the detail view, **Acknowledge** it, then **Mark Resolved** (or **Dismiss**) — all actions live right there.

### Stock Master  *(sidebar → Stock Master)*
**What it does:** Manage stock through its **Draft → Active → Inactive** lifecycle.
**Steps:**
1. On a **Draft** item → **Activate** → it moves to the **Active** tab.
2. On an **Active** item → **Deactivate** → it moves to **Inactive** (and back via **Reactivate**).
3. (Optional) click a stock code to show the movement history.

### Asset Requests  *(sidebar → Asset Requests)*  ← fulfills the employee's request
**What it does:** Review and fulfill employee asset requests.
**Steps:**
1. Open the employee's pending request → **Approve** (add a note).
2. Then **Fulfill** → pick an available asset → assign. *(This is what the employee acknowledges in Act 1's last step.)*

### Asset Registry  *(sidebar → Asset Registry)*
**What it does:** Tracks individual IT assets and their assignment status.
**Steps:**
1. On an **Available** asset → **Assign** to an employee.
2. Show **Return** on an assigned asset. *(If an asset is "assigned" but has no person, the button shows **Reset** and safely returns it to Available.)*

### Reports  *(sidebar → Reports)*
**What it does:** Generate and export operational reports.
**Steps:**
1. Pick **Current Stock Availability** → **Run Report**.
2. Click **Export Excel** (downloads a spreadsheet) and **Export PDF** (opens a print-to-PDF view). *(Allow pop-ups for PDF.)*

### Bulk Upload  *(sidebar → Bulk Upload)*
**What it does:** Import stock/distributions from Excel with **AI self-healing** (auto-corrects messy data) and strict validation.
**Steps:**
1. Upload a file with a fixable issue (e.g. category `electronics`, lowercase code) → it imports and shows **AI Self-Healing Corrections** (original → corrected + reason).
2. Upload a file with a genuinely bad row (missing required field / unknown stock code) → the **whole upload is rejected** (nothing saved) with the errors listed. *"Bad data never makes it in."*

---

# ACT 3 — L2 Authority  🔐 Logout → Login as `l2@mavericks.com`

### Exception Queue  *(sidebar → Exception Queue)*
**What it does:** Final sign-off for items L1 escalated (Server category, or qty over the threshold).
**Steps:**
1. Open the item the manager forwarded in Act 2.
2. **Approve** → confirm in the dialog. Mention **Zero-Touch Log** shows what AI cleared without humans.

---

# ACT 4 — Admin  🔐 Logout → Login as `admin@mavericks.com`

### System Admin  *(sidebar → System Admin)*
**What it does:** Central configuration. Tabs: **Users, Access Control, Catalog, System Health, Configuration, AI Policy, Workflows, Monitoring**.
**Steps:**
1. **Access Control** — pick a role, toggle a sidebar item's visibility, **Save** → *"controls what each role sees."*
2. **Configuration** — show the L2 quantity threshold and SLA settings.
3. **System Health** — service status + the >48h bottleneck alert.

### Reports → User Activity Summary  *(Reports → User Activity Summary)*
**What it does:** A **per-user activity summary** (events, distributions, approvals, last active) — distinct from the raw Audit Log.
**Steps:** Run it and contrast with **Audit Log** (sidebar), which is the raw chronological event trail.

### Reconciliation  *(sidebar → Reconciliation)*
**What it does:** Compare physical counts vs system records and flag variances.
**Steps:** Show the variance rows and the **Create Adjustment** action.

### Legal Holds  *(sidebar → Legal Holds)*
**What it does:** Lock records for compliance/litigation.
**Steps:** Open **New Legal Hold**, show scope options, mention records get locked from change.

---

# ACT 5 — Close the loop  🔐 Logout → Login as `employee@mavericks.com`

1. Go to **My Requests** → the request the manager fulfilled now shows **Acknowledge Receipt**.
2. Click it → **"Received"** stamp appears. *"Full lifecycle closed — request to acknowledged receipt."*

---

## 3. AI talking points (say these during Act 2)

- **Risk Analysis** scores every distribution → drives auto-approve vs escalate.
- **Anomaly engine** watches stock health 24/7 and explains each alert in plain English.
- **Self-healing upload** auto-corrects messy spreadsheets and rejects bad data.
- **Ask Inventory** (AI Insights) answers questions in plain English + a health score.
- *"AI scores it, a Maker-Checker L1/L2 workflow governs it, an anomaly engine watches it, and an immutable ledger records it — the system runs itself and only escalates exceptions to humans."*

---

## 4. Pre-demo checklist
- [ ] Backend + frontend running; logged out to start at the login screen.
- [ ] Approval Workbench has pending items (seeded). If empty, run `cd src/backend && npx tsx src/db/seed-approvals.ts`.
- [ ] Browser pop-ups allowed (for PDF export).
- [ ] Have a clean Excel file and a "bad" Excel file ready for the Bulk Upload demo.
- [ ] Camera permission allowed (for the photo-audit step).
</content>
