# Mavericks Inventory — Exact Demo Script

**Legend:** 🗣️ = say this out loud · 👉 = click/do this · 🔐 = switch account
**All passwords:** `DemoPass!123` · type the email manually.

---

## OPENING (at the login screen)

🗣️ "Good morning. This is **Mavericks Inventory** — an AI-assisted IT inventory and asset management platform. It does two things: it governs bulk stock through a Maker-Checker approval workflow, and it manages individual IT assets across their whole lifecycle — request, approve, assign, audit, and return. Throughout, AI is risk-scoring decisions, catching anomalies, cleaning up data, and answering questions in plain English. Let me walk you through it from each user's point of view."

🗣️ "We have role-based access — an employee, an approving manager, a senior L2 authority, and a system admin. I'll start as a regular employee."

🔐 👉 Log in as `employee@mavericks.com`

---

# ACT 1 — EMPLOYEE

## Dashboard
🗣️ "This is the employee's home screen. It shows their own snapshot — assets assigned to them, the status of their requests, and quick actions. Everything an employee sees is scoped to just them."

## Sidebar → My Inventory  *(3 sub-tabs)*
👉 Open **My Inventory**.

🗣️ "My Inventory has three tabs."

👉 **My Assets tab**
🗣️ "First, **My Assets** — every device and license assigned to me, with its condition, warranty, validity, and when its next audit is due. So an employee always knows what they're holding and what's expiring."

👉 **My Requests tab**
🗣️ "Second, **My Requests** — this tracks every request I've raised through its stages: submitted, under review, decision, fulfilled."

👉 **My Audits tab**
🗣️ "And third, **My Audits** — my history of asset photo-audits, each with the AI's verification result and confidence."

## Sidebar → Create Request
👉 Open **Create Request**.
🗣️ "Now let me raise a request for a new device."
👉 Pick **Category** (e.g. Laptop).
🗣️ "I choose a category, and the sub-category options fill in automatically."
👉 In *What do you need*, type: "Dell Latitude laptop".
👉 In *Why do you need this*, type: **"My current laptop is broken and I cannot work."**
🗣️ "Watch the priority field — as I describe my reason, the **AI reads the justification and suggests a priority.** Because I said 'broken' and 'cannot work', it's recommending **Critical**, and it shows me the exact keywords it picked up on. I can accept the AI's suggestion or override it manually."
👉 **Submit Request.**
🗣️ "Submitted — and it gives me a tracking code. My manager will be notified to review it."

## Sidebar → Submit Audit
👉 Open **Submit Audit**.
🗣️ "Companies need to periodically verify assets are still in good condition and still with the right person. Here's how an employee does that."
👉 Select an asset → choose **Self Audit**.
👉 **This Device** → **Open Camera** → **Capture Photo** (aim at the asset).
🗣️ "It's **live-capture only — no uploading old files** — and notice it burns a **timestamp watermark** into the photo, so it can't be faked. The AI then verifies the asset tag, checks condition, and confirms it matches our records."
👉 (Optional) switch to **Scan with Phone**.
🗣️ "If I'm away from my desk, I can generate a QR code, scan it with my phone, take the photo there, and it flows back here automatically."
👉 **Submit Audit.**
🗣️ "Submitted for AI analysis — the result shows up under My Audits."

## Sidebar → Stock Catalog
👉 Open **Stock Catalog**.
🗣️ "Employees can also browse the central stock catalog to see what's available before requesting."

🗣️ "That's the employee experience. Now let me switch to the manager who approves these."

🔐 👉 Log out → Log in as `manager@mavericks.com`

---

# ACT 2 — MANAGER (L1 Approver)

## Dashboard
🗣️ "The manager lands on a very different, approval-focused dashboard. Right at the top is the **pending approvals** count with average processing time. Below that, live **stock-health** charts."
👉 Point to the **Available vs Required** chart.
🗣️ "This compares what we have on hand — in blue — against the minimum we need to keep — in amber — so shortfalls are obvious at a glance."
👉 Point to **Approval Bottlenecks (>48h)** and click a row.
🗣️ "And anything stuck for more than 48 hours surfaces here as a bottleneck. If I click one, it takes me **straight into the approval queue, pre-filtered to that item** — so I can act immediately."

## Sidebar → Approval Workbench  ⭐ *(main highlight)*
🗣️ "This is the heart of the system — the Approval Workbench. Every request to move stock lands here, and **the AI has already analyzed each one.**"
👉 Point to a card's badges.
🗣️ "For each item, AI gives a **risk level**, a **recommendation** — approve, review, or reject — its **confidence**, and the reasoning. There's also an SLA bar; this one in red has already breached its deadline."

🗣️ "For the safe, low-risk requests, I don't need to touch each one."
👉 Tick a few **low-risk** items → **Bulk Approve.**
🗣️ "I select the low-risk items and **bulk-approve** them in one click — that's our zero-touch automation. AI clears the routine work so humans focus on the exceptions."

👉 On one item click **Approve** → confirmation dialog appears → **Confirm Approve.**
🗣️ "When I approve an individual item, it now asks me to **confirm first** — so nothing gets committed by an accidental click."

👉 On the high-value / large-quantity item click **Forward to L2** → add a reason.
🗣️ "This one is high-value, so policy says it needs a second signature. I **forward it to the L2 authority** with a note — that's the Maker-Checker control."

🗣️ "The workbench also has history tabs."
👉 Mention **Approval History** and **Zero-Touch Log** (sidebar).
🗣️ "**Approval History** is every decision we've made, and the **Zero-Touch Log** shows exactly what the AI auto-cleared without any human review — full transparency."

## Sidebar → Anomalies  *(tabs: All / Critical / Warning / Info)*
👉 Open **Anomalies**.
🗣️ "Separately, an anomaly engine watches stock health around the clock. It flags things like items below minimum, zero stock, or unusual consumption."
👉 Point to the tab counts.
🗣️ "They're grouped by severity — **Critical, Warning, Info** — with counts on each tab."
👉 Click a card → detail view opens.
🗣️ "If I click one, I get a clear detail view with the **AI's plain-English explanation** and a recommended action."
👉 In the detail → **Acknowledge**, then **Mark Resolved** (or **Dismiss**).
🗣️ "And right from here I can **acknowledge** it, **mark it resolved** with notes, or **dismiss** it — every action is logged for audit."

## Sidebar → Stock Master  *(tabs: Draft / Active / Inactive)*
👉 Open **Stock Master**.
🗣️ "This is our stock catalog with a full lifecycle — **Draft, Active, Inactive**."
👉 On a **Draft** item → **Activate** → switch to **Active** tab.
🗣️ "I can take a draft item and **activate** it — and it immediately moves into the Active tab."
👉 On an **Active** item → **Deactivate** → show **Inactive** tab.
🗣️ "And I can **deactivate** something to archive it — it moves to Inactive, and can be reactivated later. Nothing is ever hard-deleted."
👉 (Optional) click a stock code.
🗣️ "Clicking any item shows its full movement history."

## Sidebar → Stock Ledger
👉 Open **Stock Ledger**.
🗣️ "The Stock Ledger is our immutable audit trail — every stock movement in and out, with running balances. It exports to CSV for finance."

## Sidebar → Distributions
👉 Open **Distributions**.
🗣️ "This is the full list of stock distributions with their status, risk, and AI recommendation — filterable by status or risk."

## Sidebar → Asset Requests  *(this fulfills the employee's request)*
👉 Open **Asset Requests**.
🗣️ "Here's where I handle the request the employee raised earlier."
👉 Open the pending request → **Approve** (add a note).
🗣️ "I review the justification and **approve** it."
👉 Then **Fulfill** → pick an available asset → assign.
🗣️ "Then I **fulfill** it by assigning a specific physical asset from inventory. The employee is notified instantly."

## Sidebar → Asset Registry
👉 Open **Asset Registry**.
🗣️ "The Asset Registry tracks every individual device — laptops, monitors, phones, licenses — by status: available, assigned, maintenance, retired."
👉 On an **Available** asset → **Assign**.
🗣️ "I can assign an available asset to an employee."
👉 Point to an assigned asset's **Return** / **Reset** button.
🗣️ "And return it when it comes back. The system also self-heals — if an asset is marked assigned but has no actual owner, it gives me a Reset to put it safely back in stock."

## Sidebar → Employees
👉 Open **Employees**.
🗣️ "I can browse employees and drill into any one to see every asset they hold and what's due for audit."

## Sidebar → AI Insights
👉 Open **AI Insights**.
🗣️ "This is our natural-language analytics. There's an **AI health score** for the whole inventory, and I can **ask questions in plain English** — like 'which items are below minimum stock level' — and get an answer with the data behind it."
👉 (Optional) click a suggested query.

## Sidebar → Reports
👉 Open **Reports**.
🗣️ "We have a library of operational reports on the left."
👉 Pick **Current Stock Availability** → **Run Report**.
🗣️ "I pick one, run it, and then **export to Excel or PDF**."
👉 Click **Export Excel**, then **Export PDF**.
🗣️ "Excel downloads a spreadsheet; PDF opens a print-ready view to save."

## Sidebar → Audit Log
👉 Open **Audit Log**.
🗣️ "Every action in the system — logins, approvals, edits — is recorded here as a searchable, filterable audit trail for compliance."

## Sidebar → Bulk Upload  *(tabs: Stock Master Upload / Distribution Upload)*
👉 Open **Bulk Upload**.
🗣️ "For onboarding data in bulk, we upload Excel — and this is where AI really helps."
👉 Upload a file with a fixable issue (lowercase code, wrong category casing).
🗣️ "When the data is messy, the **AI self-heals it** — here it's standardized the category and the codes — and it shows me exactly what it changed and why."
👉 Upload a file with a bad row (missing field / unknown stock code).
🗣️ "But if a row has genuinely invalid data, the system **rejects the entire upload** and lists the errors — nothing bad ever gets saved."

🗣️ "That covers the manager. Now the high-value item I escalated needs the L2 authority."

🔐 👉 Log out → Log in as `l2@mavericks.com`

---

# ACT 3 — L2 AUTHORITY

## Dashboard
🗣️ "The L2 authority is the senior approver — they only see the exceptions that need a second signature."

## Sidebar → Exception Queue  *(tabs: Override History / Zero-Touch Log / Anomalies)*
👉 Open **Exception Queue**.
🗣️ "Here's the item the manager escalated. The same AI analysis is in front of me."
👉 Open it → **Approve** → **Confirm.**
🗣️ "I give the final approval, and only now does the stock actually move and the ledger record it."
👉 Mention **Override History** and **Zero-Touch Log**.
🗣️ "L2 also has an **Override History** — any time a human decision overruled the AI — and the **Zero-Touch Log** of everything auto-cleared. Full accountability at the top."

🗣️ "Finally, let me show the administrator's view."

🔐 👉 Log out → Log in as `admin@mavericks.com`

---

# ACT 4 — ADMIN

## Sidebar → System Admin  *(8 tabs)*
👉 Open **System Admin**.
🗣️ "The admin console runs the whole platform. There are eight areas."
👉 **Users tab** — 🗣️ "Create users, set roles, activate or deactivate accounts."
👉 **Access Control tab** — pick a role, toggle a sidebar item, **Save.** 🗣️ "I control exactly which menu items each role can see — and it applies on their next login."
👉 **Catalog tab** — 🗣️ "Manage the master lists — categories, units of measure, locations."
👉 **System Health tab** — 🗣️ "Live service status and any approval bottlenecks."
👉 **Configuration tab** — 🗣️ "Business rules — the L2 quantity threshold and the SLA timers that drive escalation."
👉 **AI Policy tab** — 🗣️ "Tune anomaly sensitivity and see which AI features are active."
👉 **Workflows tab** — 🗣️ "The approval routing rules and the stages a request passes through."
👉 **Monitoring tab** — 🗣️ "Real-time system metrics."

## Sidebar → Reports → User Activity Summary
👉 Open **Reports** → **User Activity Summary**.
🗣️ "For admins there's a **per-user activity summary** — how many events, distributions, and approvals each person has done, and when they were last active. That's different from the raw Audit Log, which is the full chronological event trail."

## Sidebar → Reconciliation
👉 Open **Reconciliation**.
🗣️ "Reconciliation compares physical stock counts against system records and flags variances, so we can create adjustments and keep the books accurate."

## Sidebar → Legal Holds
👉 Open **Legal Holds**.
🗣️ "And for compliance, admins can place a **legal hold** — locking a set of records so they can't be changed or deleted during an investigation."

🗣️ "Let me close the loop back on the employee side."

🔐 👉 Log out → Log in as `employee@mavericks.com`

---

# ACT 5 — CLOSE THE LOOP (EMPLOYEE)

👉 Open **My Requests**.
🗣️ "Remember the request I raised at the start — the manager has now approved and fulfilled it. The employee gets to confirm they actually received the asset."
👉 Click **Acknowledge Receipt** → "Received" stamp appears.
🗣️ "I acknowledge receipt, and the request is fully closed — from the first request all the way to confirmed delivery."

---

# CLOSING

🗣️ "So to summarize: every stock movement is **risk-scored by AI**, governed by a **Maker-Checker L1/L2 workflow**, continuously watched by an **anomaly engine**, and recorded in an **immutable ledger** — while employees self-serve requests and audits. The platform automates the routine and escalates only the exceptions to people. Thank you — happy to take questions."

---

## Pre-demo checklist
- [ ] Backend + frontend running; start logged out at the login screen.
- [ ] Approval Workbench has pending items. If empty: `cd src/backend && npx tsx src/db/seed-approvals.ts`
- [ ] Browser pop-ups allowed (PDF export) and camera allowed (photo audit).
- [ ] One clean Excel file + one "bad" Excel file ready for Bulk Upload.
</content>
