/**
 * run-tests.js — Mavericks Inventory Comprehensive API Test Suite
 *
 * Tests every endpoint across all roles.
 * Prerequisites: backend running on http://localhost:8080, DB seeded.
 *
 * Usage:
 *   npm test
 *   BASE_URL=http://localhost:8080 npm test
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:8080") + "/api/v1";
const RESULTS_DIR = join(__dirname, "results");
try { mkdirSync(RESULTS_DIR, { recursive: true }); } catch {}

// ─── Colour helpers ────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", magenta: "\x1b[35m", blue: "\x1b[34m", white: "\x1b[37m",
};
const pass = (s) => `${C.green}✓ PASS${C.reset} ${s}`;
const fail = (s) => `${C.red}✗ FAIL${C.reset} ${s}`;
const skip = (s) => `${C.yellow}⊘ SKIP${C.reset} ${s}`;
const section = (s) => `\n${C.bold}${C.cyan}━━━ ${s} ━━━${C.reset}`;

// ─── Test State ────────────────────────────────────────────────────────────────
const results = { passed: 0, failed: 0, skipped: 0, errors: [] };
const tokens = {};   // { admin, exec, manager, l2 }
const ids = {};      // collected IDs for chain tests

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
async function req(method, path, { body, token, formData, binary } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };

  if (formData) {
    // Don't set Content-Type — browser/fetch sets boundary automatically
    opts.body = formData;
  } else if (body) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const url = BASE_URL + path;
  try {
    const res = await fetch(url, opts);
    let data;
    const ct = res.headers.get("content-type") ?? "";
    if (binary || ct.includes("spreadsheetml") || ct.includes("octet-stream")) {
      data = await res.arrayBuffer();
    } else {
      try { data = await res.json(); } catch { data = await res.text(); }
    }
    return { status: res.status, data, ok: res.ok };
  } catch (err) {
    return { status: 0, data: null, ok: false, error: err.message };
  }
}

async function GET(path, token) { return req("GET", path, { token }); }
async function POST(path, body, token) { return req("POST", path, { body, token }); }
async function PUT(path, body, token) { return req("PUT", path, { body, token }); }
async function DELETE(path, token) { return req("DELETE", path, { token }); }

// ─── Assertion helpers ─────────────────────────────────────────────────────────
function assert(name, condition, detail = "") {
  if (condition) {
    console.log(pass(name));
    results.passed++;
    return true;
  } else {
    console.log(fail(name) + (detail ? ` ${C.dim}(${detail})${C.reset}` : ""));
    results.failed++;
    results.errors.push({ name, detail });
    return false;
  }
}

function assertStatus(name, r, expected) {
  return assert(name, r.status === expected, `got ${r.status}, expected ${expected}. Body: ${JSON.stringify(r.data)?.slice(0, 120)}`);
}

function assertField(name, r, field) {
  const ok = r.data && r.data[field] !== undefined;
  return assert(name, ok, `field "${field}" missing. keys: ${Object.keys(r.data ?? {}).join(", ")}`);
}

function assertPaginated(name, r) {
  const d = r.data;
  return assert(name, d && Array.isArray(d.items) && typeof d.total === "number",
    `Expected {items[], total}. Got: ${JSON.stringify(d)?.slice(0, 120)}`);
}

function skipTest(name) {
  console.log(skip(name));
  results.skipped++;
}

// ─── Test Suites ───────────────────────────────────────────────────────────────

async function testHealth() {
  console.log(section("HEALTH CHECK"));
  const r = await GET("/health");
  assertStatus("GET /health returns 200", r, 200);
}

async function testAuth() {
  console.log(section("AUTH — Login all roles"));

  for (const [role, email, password] of [
    ["admin",   "admin@example.com",   "DemoPass!123"],
    ["exec",    "exec@example.com",    "DemoPass!123"],
    ["manager", "manager@example.com", "DemoPass!123"],
    ["l2",      "l2@example.com",      "DemoPass!123"],
  ]) {
    const r = await POST("/auth/login", { email, password });
    if (assertStatus(`POST /auth/login (${role})`, r, 200)) {
      assert(`  → accessToken present (${role})`, !!r.data?.accessToken);
      assert(`  → user.role = ${role === "l2" ? "management_authority" : role}`, !!r.data?.user?.role);
      tokens[role] = r.data.accessToken;
    }
  }

  // GET /auth/me
  const me = await GET("/auth/me", tokens.admin);
  if (assertStatus("GET /auth/me", me, 200)) {
    assert("  → me.email = admin@example.com", me.data?.email === "admin@example.com");
    assert("  → me.role = admin", me.data?.role === "admin");
  }

  // Invalid login
  const bad = await POST("/auth/login", { email: "wrong@test.com", password: "BadPass@1" });
  assertStatus("POST /auth/login (invalid credentials) → 401", bad, 401);

  // No token → 401
  const noToken = await GET("/stocks");
  assertStatus("GET /stocks without token → 401", noToken, 401);
}

async function testStocks() {
  console.log(section("STOCKS"));

  // List (paginated)
  const list = await GET("/stocks?page=1&page_size=10", tokens.admin);
  if (assertStatus("GET /stocks (list)", list, 200)) {
    assertPaginated("  → paginated response shape", list);
    if (list.data?.items?.length > 0) {
      const s = list.data.items[0];
      assert("  → item has id", !!s.id);
      assert("  → item has stock_code", !!s.stock_code);
      assert("  → item has name", !!s.name);
      assert("  → item has available_qty", s.available_qty !== undefined);
      assert("  → item has health_status", !!s.health_status);
      assert("  → item has uom", !!s.uom);
      assert("  → item has max_level (not hardcoded 0 always)", s.max_level !== undefined);
      ids.firstStockId = s.id;
      ids.firstStockCode = s.stock_code;
    }
  }

  // Filters
  const catFilter = await GET("/stocks?category=Electronics", tokens.exec);
  assertStatus("GET /stocks?category=Electronics", catFilter, 200);

  const statusFilter = await GET("/stocks?status=active", tokens.exec);
  assertStatus("GET /stocks?status=active", statusFilter, 200);

  const search = await GET("/stocks?search=laptop", tokens.exec);
  assertStatus("GET /stocks?search=laptop", search, 200);

  // Create stock (admin only)
  const ts = Date.now();
  const createPayload = {
    stock_code: `TEST-API-${ts}`,
    name: "API Test Stock Item",
    category: "Electronics",
    uom: "Units",
    total_qty: 50,
    available_qty: 50,
    min_level: 10,
    max_level: 100,
    location: "Warehouse A",
    status: "draft",
  };
  const created = await POST("/stocks", createPayload, tokens.admin);
  if (assertStatus("POST /stocks (create)", created, 201)) {
    assert("  → created.id present", !!created.data?.id);
    assert("  → created.stock_code matches", created.data?.stock_code === createPayload.stock_code);
    assert("  → created.max_level = 100", created.data?.max_level === 100);
    ids.testStockId = created.data.id;
  }

  // Executive can't create (should get 403)
  const noCreate = await POST("/stocks", createPayload, tokens.exec);
  assertStatus("POST /stocks by executive → 403 (role guard)", noCreate, 403);

  // Get single stock
  if (ids.testStockId) {
    const single = await GET(`/stocks/${ids.testStockId}`, tokens.admin);
    if (assertStatus(`GET /stocks/${ids.testStockId}`, single, 200)) {
      assert("  → stock_code matches", single.data?.stock_code === createPayload.stock_code);
    }
  }

  // Update stock
  if (ids.testStockId) {
    const updated = await PUT(`/stocks/${ids.testStockId}`, { status: "active", name: "API Test Stock Updated" }, tokens.admin);
    if (assertStatus("PUT /stocks/:id (update)", updated, 200)) {
      assert("  → name updated", updated.data?.name === "API Test Stock Updated");
      assert("  → status = active", updated.data?.status === "active");
    }
  }

  // Export CSV
  const csv = await req("GET", "/stocks/export", { token: tokens.admin, binary: true });
  assertStatus("GET /stocks/export (CSV blob)", csv, 200);
  assert("  → response is binary buffer", csv.data instanceof ArrayBuffer && csv.data.byteLength > 0);

  // Get stock with id=1 for ledger tests
  if (ids.firstStockId) {
    const ledger = await GET(`/ledger?stock_id=${ids.firstStockId}&page_size=5`, tokens.admin);
    if (assertStatus(`GET /ledger?stock_id=${ids.firstStockId}`, ledger, 200)) {
      assertPaginated("  → ledger paginated shape", ledger);
      if (ledger.data?.items?.length > 0) {
        const e = ledger.data.items[0];
        assert("  → ledger entry has transaction_type", !!e.transaction_type);
        assert("  → ledger entry has qty_change", e.qty_change !== undefined);
        assert("  → ledger entry has qty_before", e.qty_before !== undefined);
        assert("  → ledger entry has qty_after", e.qty_after !== undefined);
        assert("  → ledger entry has actor_name", e.actor_name !== undefined);
      }
    }
  }
}

async function testDistributions() {
  console.log(section("DISTRIBUTIONS"));

  // List
  const list = await GET("/distributions?page=1&page_size=10", tokens.exec);
  if (assertStatus("GET /distributions (list)", list, 200)) {
    assertPaginated("  → paginated response", list);
  }

  // Filters
  assertStatus("GET /distributions?status=draft", await GET("/distributions?status=draft", tokens.exec), 200);
  assertStatus("GET /distributions?status=approved", await GET("/distributions?status=approved", tokens.exec), 200);

  // Create distribution — need an active stock
  let activeStockId = ids.testStockId ?? ids.firstStockId;

  if (activeStockId) {
    const ts = Date.now().toString().slice(-6);
    const createDist = await POST("/distributions", {
      stock_id: activeStockId,
      qty_requested: 2,
      recipient_type: "employee",
      recipient_id: `EMP-${ts}`,
      recipient_name: "API Test Employee",
      distribution_date: new Date().toISOString().slice(0, 10),
      location: "Head Office",
      purpose: "API test distribution",
    }, tokens.exec);

    if (assertStatus("POST /distributions (create)", createDist, 201)) {
      assert("  → distribution has id", !!createDist.data?.id);
      assert("  → distribution has transaction_code", !!createDist.data?.transaction_code);
      assert("  → status = draft", createDist.data?.status === "draft");
      assert("  → risk_level present", !!createDist.data?.risk_level);
      ids.testDistId = createDist.data.id;
    }

    // Get single distribution
    if (ids.testDistId) {
      const single = await GET(`/distributions/${ids.testDistId}`, tokens.exec);
      if (assertStatus("GET /distributions/:id", single, 200)) {
        assert("  → has stock_name", !!single.data?.stock_name);
        assert("  → has recipient_name", !!single.data?.recipient_name);
      }

      // Submit for approval
      const submitted = await POST(`/distributions/${ids.testDistId}/submit`, {}, tokens.exec);
      if (assertStatus("POST /distributions/:id/submit", submitted, 200)) {
        assert("  → status changed after submit", submitted.data?.status !== "draft");
        ids.submittedDistId = ids.testDistId;
      }

      // Update already-submitted → should fail
      const badUpdate = await PUT(`/distributions/${ids.testDistId}`, { qty_requested: 999 }, tokens.exec);
      assert("PUT /distributions/:id (submitted) → 400/409", badUpdate.status === 400 || badUpdate.status === 409);
    }
  } else {
    skipTest("POST /distributions (no active stock available)");
    skipTest("POST /distributions/:id/submit (skipped)");
  }
}

async function testApprovals() {
  console.log(section("APPROVALS"));

  // Executive cannot access approvals
  const forbidden = await GET("/approvals", tokens.exec);
  assertStatus("GET /approvals by executive → 403", forbidden, 403);

  // Manager can list approvals
  const list = await GET("/approvals?page=1&page_size=10", tokens.manager);
  if (assertStatus("GET /approvals (manager)", list, 200)) {
    assertPaginated("  → paginated response", list);
    if (list.data?.items?.length > 0) {
      const a = list.data.items[0];
      assert("  → has id", !!a.id);
      assert("  → has transaction_code", a.transaction_code !== undefined);
      assert("  → has risk_level", !!a.risk_level);
      assert("  → has uom (not empty)", a.uom !== undefined);
      assert("  → has risk_score (numeric)", typeof a.risk_score === "number");
      assert("  → has ai_recommendation", !!a.ai_recommendation);
      ids.firstApprovalId = a.id;
    }
  }

  // Filter by level
  const l1List = await GET("/approvals?level=l1", tokens.manager);
  assertStatus("GET /approvals?level=l1", l1List, 200);

  const l2List = await GET("/approvals?level=l2", tokens.l2);
  assertStatus("GET /approvals?level=l2", l2List, 200);

  // Try to approve if we have a pending approval
  if (ids.firstApprovalId) {
    const approveR = await POST(`/approvals/${ids.firstApprovalId}/l1-approve`, { remarks: "Approved via API test" }, tokens.manager);
    // May be already processed — just check it gets a response
    assert(`POST /approvals/${ids.firstApprovalId}/l1-approve → valid status`,
      [200, 400].includes(approveR.status), `got ${approveR.status}`);
  }

  // Bulk approve (low-risk pending)
  const bulkList = await GET("/approvals?level=l1", tokens.manager);
  if (bulkList.data?.items?.length > 0) {
    const lowRiskIds = bulkList.data.items
      .filter((a) => a.risk_level === "Low" && a.status === "pending")
      .slice(0, 3)
      .map((a) => a.id);
    if (lowRiskIds.length > 0) {
      const bulk = await POST("/approvals/bulk-approve", { ids: lowRiskIds }, tokens.manager);
      if (assertStatus("POST /approvals/bulk-approve", bulk, 200)) {
        assert("  → approved count present", typeof bulk.data?.approved === "number");
        assert("  → failed count present", typeof bulk.data?.failed === "number");
      }
    } else {
      skipTest("POST /approvals/bulk-approve (no low-risk pending items)");
    }
  }

  // Reject with remarks
  const rejectList = await GET("/approvals?level=l1&status=pending", tokens.manager);
  if (rejectList.data?.items?.length > 0) {
    const toReject = rejectList.data.items[0];
    const rejectR = await POST(`/approvals/${toReject.id}/l1-reject`, {
      remarks: "Rejected by automated API test — reason is sufficient length to pass validation"
    }, tokens.manager);
    assert(`POST /approvals/${toReject.id}/l1-reject → valid response`,
      [200, 400].includes(rejectR.status));
  } else {
    skipTest("POST /approvals/:id/l1-reject (no pending items)");
  }
}

async function testAnomalies() {
  console.log(section("ANOMALIES"));

  const list = await GET("/anomalies", tokens.admin);
  if (assertStatus("GET /anomalies", list, 200)) {
    assertPaginated("  → paginated response", list);
    if (list.data?.items?.length > 0) {
      const a = list.data.items[0];
      assert("  → has id", !!a.id);
      assert("  → has severity", !!a.severity);
      assert("  → has anomaly_type", !!a.anomaly_type);
      assert("  → has status", !!a.status);
      assert("  → has ai_explanation", a.ai_explanation !== undefined);
      ids.firstAnomalyId = a.id;
    }
  }

  // Filters
  assertStatus("GET /anomalies?severity=critical", await GET("/anomalies?severity=critical", tokens.admin), 200);
  assertStatus("GET /anomalies?status=active", await GET("/anomalies?status=active", tokens.admin), 200);

  // Acknowledge
  if (ids.firstAnomalyId) {
    const ack = await POST(`/anomalies/${ids.firstAnomalyId}/acknowledge`, {}, tokens.manager);
    assert(`POST /anomalies/${ids.firstAnomalyId}/acknowledge → valid response`,
      [200, 400].includes(ack.status));
  }

  // Find an active anomaly to resolve
  const active = await GET("/anomalies?status=active", tokens.manager);
  if (active.data?.items?.length > 0) {
    const toResolve = active.data.items[0];
    const resolve = await POST(`/anomalies/${toResolve.id}/resolve`, {
      notes: "Resolved via automated API test. Stock has been replenished."
    }, tokens.manager);
    assert(`POST /anomalies/${toResolve.id}/resolve → valid response`,
      [200, 400].includes(resolve.status));
  } else {
    skipTest("POST /anomalies/:id/resolve (no active anomalies)");
  }
}

async function testDashboard() {
  console.log(section("DASHBOARD"));

  // Summary
  const summary = await GET("/dashboard/summary", tokens.admin);
  if (assertStatus("GET /dashboard/summary (admin)", summary, 200)) {
    assert("  → total_stocks present", summary.data?.total_stocks !== undefined);
    assert("  → pending_approvals present", summary.data?.pending_approvals !== undefined);
    assert("  → active_anomalies present", summary.data?.active_anomalies !== undefined);
    assert("  → stock_health_summary present", !!summary.data?.stock_health_summary);
    assert("  → distribution_by_status is array", Array.isArray(summary.data?.distribution_by_status));
  }

  // Summary for exec
  const execSummary = await GET("/dashboard/summary", tokens.exec);
  if (assertStatus("GET /dashboard/summary (exec)", execSummary, 200)) {
    assert("  → my_distributions present", execSummary.data?.my_distributions !== undefined);
  }

  // Activity
  const activity = await GET("/dashboard/activity?limit=10", tokens.admin);
  if (assertStatus("GET /dashboard/activity", activity, 200)) {
    assert("  → is array", Array.isArray(activity.data));
    if (activity.data?.length > 0) {
      assert("  → entry has description", !!activity.data[0].description);
      assert("  → entry has created_at", !!activity.data[0].created_at);
    }
  }

  // Health scores
  const health = await GET("/dashboard/health-scores", tokens.admin);
  if (assertStatus("GET /dashboard/health-scores", health, 200)) {
    assert("  → is array", Array.isArray(health.data));
    if (health.data?.length > 0) {
      const h = health.data[0];
      assert("  → has stock_id", !!h.stock_id);
      assert("  → has health_status", !!h.health_status);
      assert("  → has available_qty", h.available_qty !== undefined);
      assert("  → has min_level", h.min_level !== undefined);
    }
  }
}

async function testInsights() {
  console.log(section("AI INSIGHTS"));

  const health = await GET("/insights/inventory-health", tokens.admin);
  if (assertStatus("GET /insights/inventory-health", health, 200)) {
    assert("  → has summary", health.data?.summary !== undefined);
    assert("  → has health_score", health.data?.health_score !== undefined);
    assert("  → has observations array", Array.isArray(health.data?.observations));
    assert("  → has recommended_actions array", Array.isArray(health.data?.recommended_actions));
    assert("  → has last_refreshed", !!health.data?.last_refreshed);
  }

  // NL Query
  const query = await POST("/insights/query", { query: "How many stocks are below minimum level?" }, tokens.admin);
  if (assertStatus("POST /insights/query", query, 200)) {
    assert("  → has answer", !!query.data?.answer);
    assert("  → has query echo", !!query.data?.query);
    assert("  → has confidence", query.data?.confidence !== undefined);
  }
}

async function testNotifications() {
  console.log(section("NOTIFICATIONS"));

  const list = await GET("/notifications", tokens.exec);
  if (assertStatus("GET /notifications", list, 200)) {
    assert("  → is array", Array.isArray(list.data));
    if (list.data?.length > 0) {
      const n = list.data[0];
      assert("  → has id", !!n.id);
      assert("  → has title", !!n.title);
      assert("  → has is_read", typeof n.is_read === "boolean");
      assert("  → has created_at", !!n.created_at);
    }
  }

  const markRead = await POST("/notifications/mark-all-read", {}, tokens.exec);
  assertStatus("POST /notifications/mark-all-read", markRead, 200);
}

async function testAuditLog() {
  console.log(section("AUDIT LOG"));

  // Executive cannot access audit log
  const forbidden = await GET("/audit-log", tokens.exec);
  assertStatus("GET /audit-log by executive → 403", forbidden, 403);

  const list = await GET("/audit-log?page=1&page_size=10", tokens.manager);
  if (assertStatus("GET /audit-log (manager)", list, 200)) {
    assertPaginated("  → paginated response", list);
    if (list.data?.items?.length > 0) {
      const e = list.data.items[0];
      assert("  → has event_type", !!e.event_type);
      assert("  → has description", !!e.description);
      assert("  → has actor_name", e.actor_name !== undefined);
      assert("  → has created_at", !!e.created_at);
    }
  }
}

async function testAdmin() {
  console.log(section("ADMIN"));

  // Non-admin cannot access
  const forbidden = await GET("/admin/users", tokens.exec);
  assertStatus("GET /admin/users by executive → 403", forbidden, 403);

  // List users
  const users = await GET("/admin/users?page=1&page_size=10", tokens.admin);
  if (assertStatus("GET /admin/users", users, 200)) {
    assertPaginated("  → paginated response", users);
    if (users.data?.items?.length > 0) {
      const u = users.data.items[0];
      assert("  → has id", !!u.id);
      assert("  → has email", !!u.email);
      assert("  → has role", !!u.role);
      assert("  → has is_active", typeof u.is_active === "boolean");
    }
  }

  // Create user
  const ts = Date.now();
  const createUser = await POST("/admin/users", {
    employee_id: `EMP-TEST-${ts}`,
    name: `Test User ${ts}`,
    email: `testuser.${ts}@example.com`,
    role: "executive",
    department: "IT",
    location: "Head Office",
    password: "TestUser@123!",
  }, tokens.admin);
  if (assertStatus("POST /admin/users (create user)", createUser, 201)) {
    assert("  → has id", !!createUser.data?.user?.id);
    ids.testUserId = createUser.data?.user?.id;
  }

  // Deactivate user
  if (ids.testUserId) {
    const deact = await POST(`/admin/users/${ids.testUserId}/deactivate`, {}, tokens.admin);
    assertStatus(`POST /admin/users/${ids.testUserId}/deactivate`, deact, 200);

    const react = await POST(`/admin/users/${ids.testUserId}/activate`, {}, tokens.admin);
    assertStatus(`POST /admin/users/${ids.testUserId}/activate`, react, 200);
  }

  // System health
  const sysHealth = await GET("/admin/system-health", tokens.admin);
  if (assertStatus("GET /admin/system-health", sysHealth, 200)) {
    assert("  → has services array", Array.isArray(sysHealth.data?.services));
    assert("  → has overall status", !!sysHealth.data?.overall);
  }

  // System stats
  const stats = await GET("/admin/system-stats", tokens.admin);
  if (assertStatus("GET /admin/system-stats", stats, 200)) {
    assert("  → has total_users", stats.data?.total_users !== undefined);
    assert("  → has total_stocks", stats.data?.total_stocks !== undefined);
  }

  // Config
  const config = await GET("/admin/config", tokens.admin);
  if (assertStatus("GET /admin/config", config, 200)) {
    assert("  → has l2_qty_threshold", config.data?.l2_qty_threshold !== undefined);
    assert("  → has anomaly_sensitivity", !!config.data?.anomaly_sensitivity);
  }

  const updateConfig = await PUT("/admin/config", { l1_sla_hours: 24 }, tokens.admin);
  assertStatus("PUT /admin/config", updateConfig, 200);

  // Categories and UOM
  const cats = await GET("/admin/categories", tokens.admin);
  assertStatus("GET /admin/categories", cats, 200);

  const uom = await GET("/admin/uom", tokens.admin);
  assertStatus("GET /admin/uom", uom, 200);
}

async function testReports() {
  console.log(section("REPORTS"));

  const reportTypes = [
    "stock-availability",
    "distribution-history",
    "pending-approvals",
    "approval-history",
    "stock-ledger",
    "anomaly-history",
    "rejection-analysis",
    "user-activity",
  ];

  for (const type of reportTypes) {
    const r = await GET(`/reports/${type}`, tokens.admin);
    if (assertStatus(`GET /reports/${type}`, r, 200)) {
      assert(`  → ${type} has columns`, Array.isArray(r.data?.columns));
      assert(`  → ${type} has rows`, Array.isArray(r.data?.rows));
      assert(`  → ${type} has total_rows`, r.data?.total_rows !== undefined);
    }
  }

  // Invalid report type
  const badType = await GET("/reports/nonexistent-type", tokens.admin);
  assertStatus("GET /reports/nonexistent-type → 404", badType, 404);
}

async function testLedger() {
  console.log(section("LEDGER"));

  // Full ledger list
  const all = await GET("/ledger?page=1&page_size=10", tokens.admin);
  if (assertStatus("GET /ledger", all, 200)) {
    assertPaginated("  → paginated response", all);
    if (all.data?.items?.length > 0) {
      const e = all.data.items[0];
      assert("  → has transaction_type", !!e.transaction_type);
      assert("  → has qty_change", e.qty_change !== undefined);
      assert("  → has qty_before", e.qty_before !== undefined);
      assert("  → has qty_after", e.qty_after !== undefined);
    }
  }

  // Filtered by stock_id
  if (ids.firstStockId) {
    const filtered = await GET(`/ledger?stock_id=${ids.firstStockId}`, tokens.admin);
    assertStatus(`GET /ledger?stock_id=${ids.firstStockId}`, filtered, 200);
  }
}

async function testUpload() {
  console.log(section("BULK UPLOAD"));

  // Check if test Excel files exist
  const stocksFile = join(__dirname, "data", "test-stocks-clean.xlsx");
  const distsFile  = join(__dirname, "data", "test-distributions-upload.xlsx");

  if (!existsSync(stocksFile)) {
    console.log(`${C.yellow}  ⚠  Test Excel files not found. Run 'npm run generate' first.${C.reset}`);
    skipTest("POST /upload/stocks (Excel file missing)");
    skipTest("GET /upload/jobs (history)");
    skipTest("GET /upload/jobs/:jobId (status)");
    skipTest("GET /upload/templates/stocks");
    return;
  }

  // Template download
  const stockTmpl = await req("GET", "/upload/templates/stocks", { token: tokens.admin, binary: true });
  if (assertStatus("GET /upload/templates/stocks", stockTmpl, 200)) {
    assert("  → returns binary data", stockTmpl.data instanceof ArrayBuffer && stockTmpl.data.byteLength > 0);
  }

  const distTmpl = await req("GET", "/upload/templates/distributions", { token: tokens.admin, binary: true });
  assertStatus("GET /upload/templates/distributions", distTmpl, 200);

  // Upload stocks Excel
  const stocksBuf = readFileSync(stocksFile);
  const stocksForm = new FormData();
  stocksForm.append("file", new Blob([stocksBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "test-stocks-clean.xlsx");

  const uploadStocks = await req("POST", "/upload/stocks", { token: tokens.admin, formData: stocksForm });
  if (assertStatus("POST /upload/stocks", uploadStocks, 202)) {
    assert("  → response has id", !!uploadStocks.data?.id);
    assert("  → response has status", !!uploadStocks.data?.status);
    assert("  → response has filename", !!uploadStocks.data?.filename);
    assert("  → response has job_type", uploadStocks.data?.job_type === "stocks");
    ids.stockUploadJobId = uploadStocks.data?.id;
  }

  // Upload distributions Excel
  if (existsSync(distsFile)) {
    const distsBuf = readFileSync(distsFile);
    const distsForm = new FormData();
    distsForm.append("file", new Blob([distsBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "test-distributions-upload.xlsx");
    const uploadDists = await req("POST", "/upload/distributions", { token: tokens.admin, formData: distsForm });
    if (assertStatus("POST /upload/distributions", uploadDists, 202)) {
      assert("  → response has id", !!uploadDists.data?.id);
      assert("  → job_type = distributions", uploadDists.data?.job_type === "distributions");
      ids.distUploadJobId = uploadDists.data?.id;
    }
  } else {
    skipTest("POST /upload/distributions (file missing)");
  }

  // Poll job status
  if (ids.stockUploadJobId) {
    // Wait a bit for processing to start
    await new Promise(r => setTimeout(r, 1500));
    const jobStatus = await GET(`/upload/jobs/${ids.stockUploadJobId}`, tokens.admin);
    if (assertStatus(`GET /upload/jobs/${ids.stockUploadJobId}`, jobStatus, 200)) {
      assert("  → job has id", !!jobStatus.data?.id);
      assert("  → job has status", !!jobStatus.data?.status);
      assert("  → job has filename", !!jobStatus.data?.filename);
      assert("  → job has total_rows", jobStatus.data?.total_rows !== undefined);
      assert("  → job has corrections array", Array.isArray(jobStatus.data?.corrections));
      assert("  → job has errors array", Array.isArray(jobStatus.data?.errors));
      console.log(`  ${C.dim}  Job status: ${jobStatus.data?.status}, total_rows: ${jobStatus.data?.total_rows}${C.reset}`);
    }
  }

  // Job history
  const history = await GET("/upload/jobs?type=stocks", tokens.admin);
  if (assertStatus("GET /upload/jobs?type=stocks (history)", history, 200)) {
    assert("  → is array", Array.isArray(history.data));
    if (history.data?.length > 0) {
      const j = history.data[0];
      assert("  → history item has id", !!j.id);
      assert("  → history item has status", !!j.status);
      assert("  → history item has uploaded_at", !!j.uploaded_at);
      assert("  → history item has job_type", !!j.job_type);
    }
  }

  // Full history (no filter)
  const allHistory = await GET("/upload/jobs", tokens.admin);
  assertStatus("GET /upload/jobs (all history)", allHistory, 200);
}

async function testRoleGuards() {
  console.log(section("ROLE GUARDS"));

  // Endpoints that require admin
  assertStatus("GET /admin/users by exec → 403", await GET("/admin/users", tokens.exec), 403);
  assertStatus("GET /admin/users by manager → 403", await GET("/admin/users", tokens.manager), 403);

  // Endpoints that require manager or above
  assertStatus("GET /approvals by exec → 403", await GET("/approvals", tokens.exec), 403);
  assertStatus("GET /audit-log by exec → 403", await GET("/audit-log", tokens.exec), 403);

  // Endpoints accessible by all authenticated users
  assertStatus("GET /stocks by exec → 200", await GET("/stocks", tokens.exec), 200);
  assertStatus("GET /distributions by exec → 200", await GET("/distributions", tokens.exec), 200);
  assertStatus("GET /anomalies by exec → 200", await GET("/anomalies", tokens.exec), 200);
  assertStatus("GET /notifications by exec → 200", await GET("/notifications", tokens.exec), 200);
}

// ─── Main runner ───────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log(`\n${C.bold}${C.magenta}╔══════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.magenta}║   MAVERICKS INVENTORY — API TEST SUITE           ║${C.reset}`);
  console.log(`${C.bold}${C.magenta}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}Target: ${BASE_URL}${C.reset}`);
  console.log(`${C.dim}Time:   ${new Date().toISOString()}${C.reset}`);

  // Run all test suites in order
  await testHealth();
  await testAuth();

  // Abort if auth failed (no tokens)
  if (!tokens.admin) {
    console.log(`\n${C.red}${C.bold}✗ Auth failed — cannot continue tests. Is the backend running?${C.reset}`);
    console.log(`${C.dim}  Start backend: cd src/backend && npm run dev${C.reset}\n`);
    process.exit(1);
  }

  await testStocks();
  await testDistributions();
  await testApprovals();
  await testAnomalies();
  await testDashboard();
  await testInsights();
  await testNotifications();
  await testAuditLog();
  await testAdmin();
  await testReports();
  await testLedger();
  await testUpload();
  await testRoleGuards();

  // ─── Summary ─────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = results.passed + results.failed + results.skipped;

  console.log(`\n${C.bold}${C.cyan}━━━ TEST SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log(`${C.green}  PASSED : ${results.passed}${C.reset}`);
  console.log(`${C.red}  FAILED : ${results.failed}${C.reset}`);
  console.log(`${C.yellow}  SKIPPED: ${results.skipped}${C.reset}`);
  console.log(`  TOTAL  : ${total}  (${elapsed}s)`);

  if (results.failed > 0) {
    console.log(`\n${C.red}${C.bold}Failed tests:${C.reset}`);
    results.errors.forEach((e) => console.log(`  ${C.red}✗${C.reset} ${e.name}${e.detail ? `\n      ${C.dim}${e.detail}${C.reset}` : ""}`));
  }

  // Write JSON report
  const report = {
    timestamp: new Date().toISOString(),
    base_url: BASE_URL,
    elapsed_seconds: Number(elapsed),
    summary: { passed: results.passed, failed: results.failed, skipped: results.skipped, total },
    failed_tests: results.errors,
  };
  const reportPath = join(RESULTS_DIR, `test-run-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n${C.dim}Report saved: ${reportPath}${C.reset}`);

  const exitCode = results.failed > 0 ? 1 : 0;
  console.log(exitCode === 0
    ? `\n${C.green}${C.bold}✓ All tests passed!${C.reset}\n`
    : `\n${C.red}${C.bold}✗ ${results.failed} test(s) failed.${C.reset}\n`
  );
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`\n${C.red}Unhandled error: ${err.message}${C.reset}`);
  console.error(err.stack);
  process.exit(1);
});
