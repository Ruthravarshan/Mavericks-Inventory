# Mavericks Inventory — Comprehensive QA Audit Report

**Scope:** Code-level review of every page, shared component, hook, context, and utility in `src/frontend/src/`.
**Method:** Four parallel agents each read every file in their slice and flagged dead handlers, missing validation, broken modal/form state, null-guard gaps, role-permission bypasses, API-contract mismatches, race conditions, and edge cases.
**Limitations:** This is **code-only**; nothing was exercised against a live backend. Anything that only manifests under real data (auth race, permission backend behavior, very large lists, network failures) needs manual verification with this report as the checklist.

Severity buckets:
- **CRITICAL** — broken feature, dead button, data corruption risk, silent privilege escalation.
- **HIGH** — silent failure, wrong displayed data, race condition.
- **MEDIUM** — edge case / validation gap / inefficient query.
- **LOW** — UX / accessibility / polish.

---

## TL;DR — Top issues to fix first

These are the items most likely to embarrass you in front of a user. Fix in this rough order.

1. **Fake mutations everywhere.** Stock activation/deactivation/reactivation (single + bulk), Approvals forward/escalate, Reconciliation "Approve Draft Adjustment" / "Create Adjustment", Legal Holds "View Locked Records", Assets "Edit Asset", Make-Request AI subcategory suggestion — **all use `setTimeout` or have no `onClick` and only fire a toast**. Users believe these actions succeeded.
2. **Approvals page shows fabricated data.** `enrichApproval` in [approvals.tsx](src/frontend/src/pages/approvals.tsx) replaces the backend's real `risk_score`, `risk_level`, `ai_recommendation`, `ai_reasoning`, AI confidence, and risk factors with values derived from `parseInt(id) % 4`. Approvers make decisions based on completely fake AI analysis. Stock-before/after numbers (`qty_requested * 2`) and "8 previous requests, all approved" are also hardcoded.
3. **Distribution search + risk filter are dead.** [distributions.tsx](src/frontend/src/pages/distributions.tsx) sends `search` and `risk_level` query params that the backend's `GET /distributions` doesn't even read. UI looks like it filters; it doesn't.
4. **`employee-detail.tsx` shows "Employee" placeholder always.** The backend `/employees/:id/assets` endpoint only returns assets — no name/email/department. The frontend casts `as { employee_name?: string }` and gets `undefined` for every field, displaying the literal string "Employee" as the page heading for every user.
5. **Route role guards missing.** [App.tsx](src/frontend/src/App.tsx) protects only `/admin`, `/approvals`, `/audit-log`, `/manage-requests`. A regular `user` role can URL-type into `/stocks`, `/distributions`, `/insights`, `/reports`, `/ledger`, `/legal-holds`, `/employees`, `/assets`, `/upload`, `/reconciliation`. The sidebar hides them; the routes don't.
6. **Token refresh almost certainly broken.** [api.ts:74](src/frontend/src/lib/api.ts#L74) expects refresh response shaped `{ accessToken }` (camelCase). Project convention is snake_case — the backend likely returns `{ access_token }`. After a 401, the queue is flushed with `undefined`, every retry sends `Authorization: Bearer undefined`. **Verify the actual refresh response shape and fix one or the other.**
7. **`use-toast.ts` has memory leaks and a 16-minute timer.** `TOAST_REMOVE_DELAY = 1_000_000` (16 min). `TOAST_LIMIT = 1` so only one toast ever shows — rapid errors are swallowed. The `useToast` hook's effect has `[state]` in its dep array which **re-pushes the listener on every state change**, accumulating duplicate subscribers.
8. **Anomaly tabs are all identical.** [anomalies.tsx](src/frontend/src/pages/anomalies.tsx) — clicking Critical/Warning/Info tabs changes the badge count but `<TabsContent>` for every tab renders the same `anomalies` array. Per-severity queries (`criticalData`/`warningData`/`infoData`) are only used for counts, never as the tab body.
9. **Counts derived from filtered lists.** [my-assets.tsx](src/frontend/src/pages/my-assets.tsx), [my-requests.tsx](src/frontend/src/pages/my-requests.tsx) — the "Pending (3) · Approved (8) · …" pills are computed from the *currently visible* (filtered) list. Select "Pending" and the "Approved" pill shows 0 even when there are approved items. Only the "All" count reads `data.total`.
10. **Dashboard hero numbers can be wrong.** [ledger.tsx](src/frontend/src/pages/ledger.tsx) — "Total Stock In / Out / Net Movement" KPI cards sum only the current page of 20 rows, not the full dataset. Pagination filters are also client-side over those 20 only — searching for `ABC` on page 1 of 50 will not find ABC on page 7.
11. **Reconciliation imports run sequentially, no batching.** A 1000-row CSV fires 1000 sequential `submitCount` requests with no progress UI. User sees a spinner that appears frozen.
12. **Camera flows have frozen countdown + no timeout.** [asset-audit.tsx](src/frontend/src/pages/asset-audit.tsx) — the QR session expiry countdown text never updates because there's no `setInterval` driving re-renders. [mobile-audit.tsx](src/frontend/src/pages/mobile-audit.tsx) — upload `fetch` has no timeout and no progress bar; on a slow mobile uplink the user is stuck with a spinner.
13. **Stock Master tab counts and filters are wrong at scale.** [stocks.tsx](src/frontend/src/pages/stocks.tsx) — `useListStocks` is called with `page_size: 20` and the page does **all** lifecycle filtering and pagination client-side over only those 20 rows. Once total stocks exceed 20, every count and tab visibility is wrong.
14. **`auditor` role is invisible to all role helpers.** [auth-context.tsx](src/frontend/src/contexts/auth-context.tsx) defines `isAdmin/isManager/isL2/isUser/isExecutive` but no `isAuditor`. `isManagerOrAbove` excludes auditor; `isRegularUser` is false for auditor. Auditors have a sidebar built for them but are treated as "no role" by every guard.
15. **No global error UI on queries.** Almost every page silently renders "empty list" on API failure. Users cannot distinguish "no data exists" from "backend is down".

---

## Full inventory

### `App.tsx` & root

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | App.tsx:77–95 | Many sensitive routes (`/stocks`, `/distributions`, `/ledger`, `/legal-holds`, `/employees`, `/assets`, `/insights`, `/reports`, `/upload`, `/reconciliation`, `/distributions/new`) have **no role guard**. Only `/admin`, `/approvals`, `/audit-log`, `/manage-requests` use guards. URL-typing bypasses sidebar role hiding. |
| CRITICAL | App.tsx:77–83 | `PublicRoute` redirects to `/dashboard` if `user` OR `accessToken` is set. If storage is half-corrupted (one set, other missing), `ProtectedRoute` bounces back → infinite redirect loop. |
| HIGH | App.tsx:75 | `ProtectedRoute` doesn't gate on `user`. If `accessToken` is valid but `authApi.me()` fails, protected pages render with `user.role` undefined and crash. |
| HIGH | App.tsx:85–95 | `AdminRoute`/`ManagerRoute` evaluate `isAdmin/isManagerOrAbove` before `user` is hydrated. On a fresh reload, admins are briefly redirected to `/dashboard` for one render cycle. |
| HIGH | App.tsx:173–186 | Error boundary fallback uses `bg-slate-900` and theme vars that haven't been applied yet if the error occurs before `ThemeProvider`'s effect. |
| MEDIUM | main.tsx | No global `QueryClient.onError` — query failures are silent unless individual hooks toast. |
| LOW | main.tsx:18 | `StrictMode` causes effects to double-fire in dev — masks side-effect bugs (e.g. `applyThemeToDom` called twice). |

### `contexts/auth-context.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L86 | `isManagerOrAbove = isAdmin \|\| isManager \|\| isL2`. Excludes `isExecutive` even though executive sidebar shows transaction creation. |
| CRITICAL | L86 | `auditor` role is not detected by any `isAdmin/isManager/isExecutive/isL2/isUser` flag. `isRegularUser` and `isManagerOrAbove` are both `false` for auditors. |
| CRITICAL | L26–33 | Initial state reads `mavericks_user` from localStorage with no token↔user binding check. Could authenticate as wrong user if storage is stale. |
| HIGH | L38–52 | `me()` only runs if `accessToken && !user`. Stored user with stale role survives forever. |
| HIGH | L46–50 | `me()` failure clears auth silently with no toast/navigate — user gets bounced to login by `ProtectedRoute` re-render, racing with in-flight queries that 401. |
| HIGH | L69–79 | `logout()` calls `authApi.logout()` first. If that 401s, response interceptor refreshes the token, then `clearStoredAuth()` runs — but a refreshed token may be left in storage. |
| MEDIUM | — | No multi-tab sync. Logout in tab A leaves tab B authenticated. |
| MEDIUM | L35 | `isLoading` starts `false` even during initial hydrate — consumers can't show a loading state. |

### `contexts/theme-context.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L334–371 | FOUC: `applyThemeToDom(BUILT_IN_PRESETS[0].dark!)` runs first, then stored theme is applied. Users with non-default themes see the obsidian-dark for one paint frame. |
| CRITICAL | L380–392 | If a custom preset is active and user toggles dark/light, `getPresetVars` ignores mode (custom themes are mode-agnostic). Mode state changes but nothing visually updates. |
| CRITICAL | L346–371 | If `stored.activePresetId` references a deleted custom preset, `useEffect` returns early without applying default — leaves stale state. |
| HIGH | L83–88 | `bumpL` only bumps lightness. Colors at 0% or 100% lightness collapse derived `secondary`/`muted`/`accent` to identical shades. |
| HIGH | L269 | `primaryFg = primaryL > 55 ? dark : white`. Doesn't account for hue/saturation. Bright yellows (60° hue, 100% sat, 56% L) get white text → unreadable. |
| MEDIUM | L325 | Bumping `STORAGE_KEY` to v4 discards any custom themes users saved on v3 with no migration. |
| MEDIUM | L416–426 | `saveAsCustom` doesn't validate uniqueness of theme name. |
| MEDIUM | L428–444 | No confirmation before deleting a custom preset. |
| MEDIUM | L185–190 | `<input type="color">` fires `onChange` for every cursor move — 10s of `applyThemeToDom` calls per interaction. |

### `lib/api.ts`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L74 | Refresh response typed `{ accessToken }` (camelCase) but project convention is snake_case. If backend returns `{ access_token }`, `newToken = undefined` → every retry sends `Authorization: Bearer undefined`. **Verify against backend response.** |
| CRITICAL | L52–58 | Refresh skipped for any URL containing `/auth/` — includes `/auth/me`. Token revoked server-side → silent logout even when refresh would have worked. |
| CRITICAL | L84 | `window.location.replace("/login")` hard-redirects on refresh failure. Destroys SPA state (unsaved drafts, scroll). Also redirects from `/mobile-audit` (public route) breaking the public flow. |
| HIGH | L22–26 | No axios `timeout`. Hung requests block UI forever. |
| HIGH | L36–45 | `isRefreshing` and `pendingQueue` are module-level singletons. A stale `_retry` request can race past `isRefreshing === false` and trigger a second refresh — multiple refresh tokens consumed. |
| HIGH | L298–309, L202–211 | `assetAuditApi.submit` / `uploadStocks` send explicit `Content-Type: multipart/form-data` without boundary. Axios usually overrides for FormData, but explicit override may strip the boundary. |
| MEDIUM | L96–104 | `login` posts camelCase `{ email, password }`; `changePassword` posts snake_case `{ old_password, new_password }`. Inconsistent. |
| MEDIUM | — | Token-revoke pattern (change password should invalidate other sessions) — old tokens remain valid. |

### `hooks/use-queries.ts`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L46–50 | `useGetDashboardActivity` is never invalidated by stock/distribution mutations. Activity feed stays stale. |
| HIGH | L82–91 | `useCreateStock` doesn't invalidate `CONFIG_CATEGORIES`, ledger, or audit log. |
| HIGH | L105–114 | `useDeleteStock` doesn't invalidate ledger or distributions referencing the stock. |
| HIGH | L177–183 | `useSubmitDistribution` doesn't invalidate audit log. |
| HIGH | L255–266 | `useBulkApprove` doesn't invalidate `[...APPROVALS, id]` — bulk-approved items keep stale individual-cache. |
| HIGH | L460–473 | `useGetJobStatus` polls every 2s until `completed`/`failed`. For any other status (e.g. `error`, `cancelled`), polling never stops. |
| HIGH | L321–326 | `useNLQuery` mutation has no `onError`. Failures silent unless caller wraps. |
| MEDIUM | L77 | `useGetStock(id)` `enabled: !!id` — but `"undefined"` string from a bad route param is truthy → 404 fetched. |
| MEDIUM | L394–397, L530 | `useGetSystemHealth` polls every 30s — keeps running even after admin page leaves observers because react-query keeps refetching while observers exist. |

### `hooks/use-toast.ts`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L4 | `TOAST_LIMIT = 1`. Only one toast ever shows; rapid errors swallow each other. |
| CRITICAL | L5 | `TOAST_REMOVE_DELAY = 1_000_000` (~16 min). Dismissed toasts stay in memory for 16 minutes; memory grows unbounded. |
| CRITICAL | L168–176 | `useEffect` registers listener with `[state]` dep array — re-pushes a new listener on every state change → exponential listener growth. |
| HIGH | L21 | Module-level `count` ID generator collides under StrictMode double-mount. |

### Components

#### `app-layout.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L383–386 | `isActive` logic: when on `/approvals?tab=history`, both "Approval Workbench" and "Approval History" sidebar items render as active simultaneously. |
| CRITICAL | L69 | `useListAnomalies({ severity: "critical", status: "active" })` fires for every authenticated user regardless of role. Regular users get 403/wasted bandwidth. |
| HIGH | L411–415 | "Asset Requests" badge displays `pendingApprovals` (distribution-approval count) — wrong number for that menu item. |
| HIGH | L88–91 | `handleLogout` doesn't close profile dropdown before `navigate`. Orphan dropdown on destination page. |
| MEDIUM | L313–320 | Role string match is case/whitespace sensitive — backend variation silently downgrades user to employee sections. |
| MEDIUM | L463–467 | Breadcrumb derives from pathname. `/stocks/abc-123-uuid` → "Abc 123 Uuid" displayed as friendly name. No resource-name mapping. |
| LOW | L515–530 | Breadcrumb missing `aria-label="breadcrumb"` and `<ol>` semantics. |
| LOW | L547–602 | Profile dropdown lacks `role="menu"`/`aria-expanded`; no keyboard focus trap. |

#### `notification-panel.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L283–287 | Notifications list rows have **no click handler** despite having a `link` field on each item. Looks interactive, does nothing. |
| HIGH | L125–130 | Polls every 30s indefinitely while mounted; no pause when tab hidden. |
| HIGH | L132–137 | `markAllRead` mutation has no `onError`. |
| MEDIUM | L208 | Mobile overlay uses `sm:hidden` (≤640px) but panel itself is `w-80 sm:w-96` — on 641px viewport, panel doesn't fill screen AND no overlay → click-through bug. |
| MEDIUM | L284 | No virtualization for long lists. |

#### `notification-bell.tsx`

| Severity | Location | Issue |
|---|---|---|
| LOW | — | **Component appears unused** (AppLayout imports `NotificationPanel` instead). Dead code in bundle. *Verify before deleting.* |

#### `theme-customizer.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L391–411 | `const vars = preset.vars!` — corrupted custom preset (missing `vars`) crashes on access. |
| HIGH | L428–435 | Delete button has no confirmation. One misclick destroys a saved theme. |
| HIGH | L257–260 | `handleCreate` closes form optimistically; `saveAsCustom` returns nothing — silent failure if save quota exceeded. |
| MEDIUM | L185–190 | Color picker fires `onChange` on every cursor move — applies theme tens of times per interaction. |

#### `theme-toggle.tsx`, `page-transition.tsx`

| Severity | Location | Issue |
|---|---|---|
| LOW | — | Both appear unused. Dead code. *(Verify; I built cursor-glow recently, which the agent also flagged as unused but I added it to login.tsx — agent missed it.)* |

#### `cursor-glow.tsx`

| Severity | Location | Issue |
|---|---|---|
| MEDIUM | — | 520×520 composite layer with blur + screen blend mode — GPU-heavy on lower-end laptops. Already gated by `pointer: fine` + `prefers-reduced-motion` but no further opt-out. |
| LOW | L38–61 | Effect runs once on mount; runtime media-query changes (touch ↔ mouse hybrid devices) don't update state. |

#### UI primitives

| Severity | File:Line | Issue |
|---|---|---|
| HIGH | stat-card.tsx:68–71 | `useCountUp` initialized with `NaN ? 0 : numericValue`; if `target` flips between string and number across renders, animation never starts on the second numeric set → stuck on 0. |
| HIGH | stat-card.tsx:37 | `cancelAnimationFrame` only on cleanup; if `target` changes mid-animation the old `raf` is orphaned, two animations compete. |
| MEDIUM | dialog.tsx:42–45 | Built-in close button uses `focus:ring-ring` — `ring-ring` is not a valid Tailwind class. Ring won't render. |
| MEDIUM | dialog.tsx:35 | Max width `max-w-lg` hard-coded; no `max-w-[95vw]` cap → dialog can exceed viewport on small landscape mobile. |
| MEDIUM | tabs.tsx:37–40 | "Sliding active background" claimed but it's just an opacity flip — no real animation. `ring-ring` issue same as dialog. |
| MEDIUM | toast.tsx:13–21 | Mobile viewport positions toast at top, covers nav. No safe-area inset. |
| MEDIUM | toast.tsx:25 | `overflow-hidden` clips long messages with no scroll/wrap. |
| MEDIUM | toaster.tsx | No `duration` prop passed to `Toast` — uses Radix default (~5s); urgent errors disappear before user reads. |
| MEDIUM | progress.tsx:19 | `transform: translateX(-${100 - (value \|\| 0)}%)` doesn't clamp `value > 100`. |
| MEDIUM | dropdown-menu.tsx:42–46 | Depends on `--popover` token; custom presets without it could cascade nulls. |
| MEDIUM | alert.tsx:11 | Default variant uses bare `text-foreground` (not `text-[hsl(var(--foreground))]`) — must be mapped in tailwind config or icon renders uncolored. |
| MEDIUM | alert.tsx:14–17 | `warning`/`success` use hardcoded `text-amber-400` / `text-green-400` — not theme-aware. |
| LOW | skeleton.tsx | No `role="status"` / `aria-busy` — screen readers don't announce loading. |
| LOW | badge.tsx:38–42 | Renders `<div>` not `<span>` — invalid HTML inside `<p>`/`<button>`. |
| LOW | animated-list.tsx:75–77 | Stagger delay capped at 240ms — rows past index 12 animate simultaneously. |
| LOW | animated-list.tsx:11–25 | Variants don't respect `prefers-reduced-motion`. |

### `lib/utils.ts`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L8–42 | `formatDate` / `formatDateTime` / `formatRelativeTime` return `"Invalid Date"` literal on bad input. Used in notification timestamps — visible corruption. |
| MEDIUM | L44–46 | `formatNumber(NaN)` returns `"NaN"`; `formatNumber(Infinity)` returns `"∞"`. Used by StatCard. |
| LOW | L10 | Locale hard-coded to `en-IN`. |

### `lib/fuzzy.ts`

| Severity | Location | Issue |
|---|---|---|
| MEDIUM | L67 | `compact = q.length / Math.max(1, t.length - firstMatch)` can exceed 1, inflating score above documented 0.55–0.75 range. |
| MEDIUM | L72 | Edit-distance fallback skipped for queries `< 3` chars — 2-char product code typos can't match. |
| MEDIUM | L82 | Damerau-Levenshtein compared only to prefix of `t` — misses typos in the middle of long names. |
| MEDIUM | L19 | DP matrix is `(al+1) × (bl+1)`. On 1000+ items × 50-char queries can lag UI. |

### `lib/constants.ts`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L62–66 | `HEALTH_COLORS` has no default — missing score falls through to "critical" in `HealthBadge`. Alarming false positive. |
| MEDIUM | L41–48 | `STATUS_COLORS` uses hardcoded `bg-gray-500` etc. — not theme tokens. Wash out on light themes. |
| MEDIUM | L105–110 | `PRIORITY_COLORS.low` uses theme tokens; others use Tailwind palette. Inconsistent. |
| LOW | All `*_COLORS` | Hardcoded Tailwind palettes don't follow theme. |

---

## Pages (alphabetical)

### `admin.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L601, L660–664 | `useEffect(() => setSensitivity(...), [config])` — `config = configQuery.data ?? {}` (new empty object every render when undefined) → infinite re-render loop, **wipes user edits on every refetch**. |
| CRITICAL | L98, L117 | Role/Location Selects use `setValue` without `register()`. Not a Controller. Errors only populate on submit; reset doesn't clear the Select trigger. |
| CRITICAL | L70 | Dialog `onOpenChange` doesn't reset form state. Reopening shows previous user's data. |
| HIGH | L350–356 | `handleSave` sends only `form` (partial). Works if backend supports `Partial<SystemConfig>`, fails silently otherwise. |
| HIGH | L466–494, L508, L538, L568 | Catalog X-icon delete buttons have **no confirmation** — single-click destroys in-use categories/locations/UOMs. |
| HIGH | L598, L604, L671 | `(config as any)[k]` — type-cast hides backend contract drift; `updateConfig.mutateAsync` has no try/catch. |
| MEDIUM | L376, L411, L419, L436, L668–672 | Threshold/SLA number inputs accept negative, decimal, NaN — `Number("") || 0` silently writes 0. |
| MEDIUM | L520, L550, L580 | Enter on add input doesn't check `isPending` — rapid Enter creates duplicates. |
| MEDIUM | L62–69 | `createUser` mutation error doesn't surface backend's actual message (rate-limit, duplicate). |
| MEDIUM | L107–110 | `useCategories` `placeholderData: STOCK_CATEGORIES` — non-admin sees fallback list even on backend failure. |

### `anomalies.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L329–371 | All four TabsContent (`all`/`critical`/`warning`/`info`) render the same `anomalies` array. Per-severity queries used only for badge counts, never for tab body. |
| HIGH | L284–286 | "Active count" headline excludes info-severity active anomalies. |
| MEDIUM | L78–81 | Resolve modal's form `notes` isn't reset on error. Reopens with stale text. |
| MEDIUM | L59 | Dialog `open` toggles based on `!!anomaly` but form mount is continuous — `notes` field never resets between anomalies. |
| LOW | L399–408 | Empty state "Inventory is looking healthy" shown even when a Critical filter is active and there are critical anomalies elsewhere. Misleading. |
| LOW | L417–424 | "Mark as Resolved" only renders for `acknowledged` status — active anomalies can't be resolved directly. Unclear flow. |

### `approvals.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L83–138, L96–104 | `enrichApproval` **replaces** backend's real `risk_score`, `risk_level`, `ai_recommendation`, `ai_reasoning`, `ai_confidence`, `risk_factors` with `RISK_SCORE_MAP[(parseInt(id) \|\| charCodeAt(0)) % 4]`. All AI data shown to approvers is fake. |
| CRITICAL | L1005–1017 | Forward-to-L2 and Escalate-Back actions are **dead** — no API call, only toast. |
| CRITICAL | L359–361 | `stockBefore = qty_requested * 2`, `stockAfter = stockBefore - qty_requested` — fabricated stock-impact visualization. |
| CRITICAL | L518–519 | Hardcoded "8 previous requests, all approved" string. |
| CRITICAL | L920 | `autoApprovedToday = 12` — stub KPI. |
| HIGH | L880–883 | Type filter (Return/Transfer/Adjustment) empties list silently when selected — filter is unimplemented. |
| HIGH | L863–906 | All filtering and sorting client-side over first page only. SLA-breached / avg-age KPIs computed over visible page, not full queue. |
| HIGH | L827–828 | `bulkApprove` always calls L1 endpoint regardless of `isL2` — L2 user's bulk approval goes to wrong route. |
| HIGH | L671 | `<TypeBadge type="distribution" />` is hardcoded — every approval shows "Distribution" type. |
| HIGH | L733 | Inline Approve button passes `""` for remarks regardless of detail-panel input. |
| MEDIUM | L1314–1318, L1370–1374 | Reject/Forward dialog `onOpenChange` doesn't reset `rejectTargetId`/`rejectRemarks`/`rejectError` — reopening shows previous user's text. |
| MEDIUM | L654 | Selected IDs not removed after successful approve — stale IDs in `selected` set. |
| MEDIUM | L1043 | Hardcoded `mr-[480px]` panel offset breaks below desktop width. |
| LOW | L1077 | Refresh button icon is `RotateCcw` (usually = undo), should be `RefreshCw`. |
| LOW | L385–390 | Detail panel close button missing `aria-label`. |

### `asset-audit.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L147–186 | QR session countdown text `qrSecondsLeft` (L426) is computed from `Date.now()` but **no `setInterval` drives re-renders** → countdown is frozen at the last unrelated render. |
| CRITICAL | L188 | `qrPolling` only set false when mobile uploads. On session expiry, "Waiting for photo from phone…" persists forever; "Session timed out" branch at L408 unreachable. |
| HIGH | L93–105 | All `getUserMedia` errors lumped into "Camera access denied" — NotFoundError / NotReadableError / OverconstrainedError look identical. |
| HIGH | L165–172 | `atob` of `photo_data_url` has no try/catch — malformed payload crashes polling. |
| HIGH | L420 | `navigator.clipboard?.writeText(qrUrl)` calls success toast unconditionally — non-HTTPS / older browsers, nothing copied. |
| MEDIUM | L48–50 | `preselectedAssetId` from URL not validated against `myAssets` — invalid id silently no-ops. |
| MEDIUM | L107–136 | `capturePhoto` doesn't check `videoWidth > 0` — clicking Capture before metadata loads creates a blank 1×1 image. |
| MEDIUM | L129–131 | `canvas.toBlob` is async — rapid double-click can overwrite `capturedFile` with stale blob. |

### `assets.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L234–237 | "Edit Asset" button in detail panel is permanently `disabled` — dead button visible to managers. |
| HIGH | L444–453 | `createMutation` sends `purchase_date: ""` / `warranty_expiry: ""` rather than omitting — backend Zod date validation may fail or persist invalid dates. |
| HIGH | L473–480 | Return action has **no confirmation dialog** — irreversible mutation on click. |
| HIGH | L457–471 | Assign mutation never collects/sends `purpose` or `notes` despite backend supporting them. |
| HIGH | L438–442 | Employees query `enabled: !!assignDialog` — opens with empty Select until response arrives, no loading indicator. |
| MEDIUM | L572–577 | Search has no debounce — every keystroke fires a request. |
| MEDIUM | L957–969 | `<SelectItem value={emp.id}>` uses string id; backend coerces with `Number()`. Breaks if employees ever become UUIDs. |
| MEDIUM | L741 | Create dialog `onOpenChange` doesn't reset `createForm` — reopens with stale partial fill. |
| MEDIUM | L867–879 | Purchase Date and Warranty Expiry inputs allow future purchase dates and warranty earlier than purchase. |
| MEDIUM | L482, L487 | `otherCount = totalAssets - availableCount - assignedCount` briefly shows wrong value while stats queries load. |

### `audit-log.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L82 | Search fires API request on every keystroke — no debounce. |
| HIGH | L49–56 | Query error is silently ignored. |
| MEDIUM | L46–47 | `dateFrom`/`dateTo` not validated `from <= to`. |
| MEDIUM | L170 | `entry.event_type.replace(...)` without `?.` — null throws. |
| MEDIUM | L173–175 | Long descriptions truncate to one line with no expand/tooltip — bad for forensic work. |
| MEDIUM | L155 | Rows aren't clickable — no way to jump from audit entry to affected entity. |

### `dashboard.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L423–427 | `summary?.stock_health_summary.healthy` — only outer `summary` is optional-chained. If `stock_health_summary` is missing, throws. |
| HIGH | L292, L294, L418, L421, L570, L574 | Multiple queries have no `isError` UI — failure renders zeros / empty state, masking outages. |
| HIGH | L172–192 | `useCountUp` resets to 0 every time `target` changes. Cards visibly re-animate from 0 on every cache refetch — looks like data was lost. |
| HIGH | L731–735 | Role gating relies on client booleans only. If `user` is null mid-hydrate, all flags are false and Executive dashboard renders for everyone. |
| MEDIUM | L222 | `typeof value === "number"` is true for `NaN`. `formatNumber(NaN)` renders `"NaN"`. |
| MEDIUM | L522 | Pie label callback overflows SVG on long category names. |

### `distributions.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L209–218 | `search` and `risk_level` are sent as query params but **backend `GET /distributions` doesn't read them** — filter+search are silently dead. |
| CRITICAL | L244 | Search hits API on every keystroke — no debounce. |
| HIGH | L67, L329 | `STATUS_COLORS[distribution.status]` has no fallback. Backend-added statuses render with className `... undefined`. |
| HIGH | L163 | "Approval History" timeline relies on `distribution.approval_history`, but `toDistributionResponse` hardcodes `approval_history: []`. Dead UI. |
| MEDIUM | L41 | `showFullReasoning` doesn't reset between distributions if Dialog content persists. |
| MEDIUM | L355–364 | Pagination is only Prev/Next, no page picker. |
| MEDIUM | L295–306 | Empty-state "Create your first distribution" CTA shows for all roles; non-creators hit 403 on submit. |

### `employee-detail.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L260–266 | Cast `as { employee_name?: string }` etc. — backend `/employees/:id/assets` returns ONLY `{ items, total }`. **Every field is `undefined`**. Heading always renders the literal string `"Employee"`. Avatar always shows `"E"`. The whole page is fundamentally broken — needs a new endpoint or join. |
| HIGH | L244–248 | No `isError` UI — invalid/non-existent id silently renders empty hero. |
| HIGH | L241–242 | `id!` non-null assertion. Missing param renders broken page instead of redirect. |

### `employees.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L175–178, L183–189 | `statsData` query uses `page_size: 100`. Departments are derived only from first 100 employees — departments existing on records 101+ never appear in the filter. |
| HIGH | L191–198 | Department filter applied client-side over the *paginated server response*. Filtering by department shows only those on the current page — totalPages is wrong, "5 employees" might show as "2". |
| HIGH | L201–203 | `totalAssignedAssets` sums only first 100 records. |
| MEDIUM | L150–160 | Custom debouncer stores `setTimeout` ID in state but doesn't clean up on unmount → stale `setDebouncedSearch` fires on unmounted component (React 18 warning). |
| MEDIUM | L162–172 | No `isError` UI. |

### `insights.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L43–50 | `handleQuery` `catch {}` swallows errors and `setQuery("")` clears input before success is known — user loses what they typed on failure. |
| MEDIUM | L130, L145 | `health.observations.map`/`health.recommended_actions.map` without `?? []` guard. |
| MEDIUM | L227 | `currentResult.columns.length > 0` accessed without optional chaining. |
| MEDIUM | L240 | Result data truncated to 10 rows silently — no "showing 10 of N" indicator. |
| MEDIUM | L244 | `String(row[col] ?? "—")` produces `"[object Object]"` for nested values. |
| LOW | L36, L37 | History only in memory — tab switch / remount loses it. |

### `ledger.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L68–76 | Client-side search filters over **current page of 20 only**. Searching "ABC" on page 1 of 50 never finds ABC on page 7. |
| HIGH | L74 | Same as above for type filter. |
| HIGH | L78–79 | "Total In / Total Out / Net Movement" KPIs are computed over current page only — misleading dashboard. |
| MEDIUM | L15–55 | `exportLedgerToCsv(filtered)` exports only the currently visible 20 rows, not the full ledger. |
| MEDIUM | L249–265 | Pagination button window produces invalid page numbers when `totalPages < 5` (e.g. pages [1,2,3,4,5] shown for a 2-page result). |

### `legal-holds.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L295–298 | "View Locked Records" button has no `onClick` — dead. |
| HIGH | L139–145 | `releaseMutation` has no `onError`. |
| HIGH | L131–137 | Query has no error state. |
| HIGH | L122 | No page-level role guard for non-admins; backend must enforce. |
| MEDIUM | L21–42 | `records_locked` accepts `NaN` from arbitrary input → request sends `null`, may insert as 0 silently. |
| LOW | L45 | Modal isn't a proper Dialog — no portal, no focus trap, no ESC handler, no `role="dialog"`. |

### `login.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L166–177 | `login()` return access `user.role` — if `login` returns null/undefined briefly, throws. |
| HIGH | L645–688 | Demo "Quick access" buttons aren't disabled while login in flight — can mutate form mid-authentication. |
| HIGH | — | No check for existing valid token on mount — logged-in user manually navigating to `/login` sees the form again. |
| MEDIUM | L43 | `password: z.string().min(1)` — only enforces non-empty client-side. |
| MEDIUM | L179–183 | `fill()` sets values but doesn't trigger validation — stale error messages persist. |
| LOW | L645–688 | Demo credential buttons leak in production builds. Should be gated behind `import.meta.env.DEV`. |

### `make-request.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L83–87 | 650ms `setTimeout` "AI suggesting subcategories" is fake — user waits thinking it's a real call. |
| HIGH | L97–99 | `onError` shows generic "Please try again" — no specific Zod / auth error surfaced. |
| MEDIUM | L37–43 | No max length on `item_description` or `reason` — 10,000-char inputs allowed. |
| MEDIUM | L74–88 | If user is typing in custom-subcategory input and category changes, their text disappears without warning. |

### `manage-requests.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L344–356 | `fulfillMutation` invalidates `REQUESTS` and `ASSETS` but **not `MY_ASSETS`** — employee can't see new asset until manual refresh. |
| HIGH | L313–320 | `availableAssets` filters by `category` exactly — if asset category and request category don't match exactly, manager can't fulfill. No override. |
| HIGH | L322–331 | Approve mutation doesn't invalidate `MY_REQUESTS` or notifications — employee cache stays stale. |
| MEDIUM | L583–589 | Reject `reviewNotes` state shared with approve — rapid toggle persists previous notes. |
| MEDIUM | L583–589 | Validity date has no `min={today}` — manager can pick past date. |
| MEDIUM | L344–356 | Fulfill doesn't collect/send `notes` field despite backend supporting it. |
| MEDIUM | L667–673 | "No available assets in this category" with no link to Add Asset — dead end. |

### `mobile-audit.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L84–87 | `fetch` has no timeout. On slow mobile network, upload hangs indefinitely with no cancel button. |
| CRITICAL | L78–97 | No upload progress indicator for 1–5MB photo. User might retry, dup-uploading to a single-use session. |
| HIGH | L46–70 | `toBlob` returning null (Safari quirks) → Upload button never appears → user stuck. |
| HIGH | L78–97 | On 410 session expired, blob/preview not cleared. "Try Again" restarts camera, orphaning captured blob. |
| HIGH | L84 | Hardcoded `/api/v1/audit-mobile/...` path — breaks if app served from non-root. |
| MEDIUM | L34–37 | All getUserMedia errors lumped as "permission denied". |
| MEDIUM | L86–87 | Mobile device may submit `image/heic`; backend may not accept. No type check. |

### `my-assets.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L539–555 | Three queries, no `isError` UI on any of them. |
| HIGH | L566–572 | Per-status request counts (Pending/Approved/Fulfilled/Rejected) derived from **currently filtered list** — pills show 0 for non-selected statuses whenever a filter is active. |
| HIGH | L562–564 | `expiringCount` / `expiredCount` / `auditDueCount` derive from `assets` after `?? []`. While loading, all show 0 → momentary "all clear" even with actual problems. |
| MEDIUM | L93–99 | Malformed `validity_date` → `Math.ceil(NaN) = NaN` → renders "Expires in NaNd". |
| MEDIUM | L575 | URL builds `assignment_id` param but `/asset-audit` never reads it. Dead param. |
| MEDIUM | L617 | `user?.name` — if user is null, briefly renders "Welcome back, undefined". |

### `my-requests.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L266–273 | Single query, no `isError` UI. |
| HIGH | L276–282 | `counts` per status from filtered list — same bug as my-assets. Non-selected status pills show 0 when filter active. |
| MEDIUM | L86 | Unknown statuses default `currentStep = 0` silently. |
| LOW | L291–296 | Back button hardcoded `/my-assets` — ignores referrer. |

### `new-distribution.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L295 | Location Select has `onValueChange` but no `value` prop and no `register` — uncontrolled with no defaultValue, won't display selection on reset. |
| HIGH | L201 | Quantity input `max={selectedStock?.available_qty}` is a soft hint — user can paste larger value. Zod has no `max`. |
| HIGH | L80–99 | Generic "Failed to save draft / submit distribution" — backend's `STOCK_NOT_ACTIVE` / `INSUFFICIENT_STOCK` codes invisible. |
| HIGH | L94 | If create succeeds but submit fails, orphan draft in DB and retry creates duplicates. |
| MEDIUM | L50–53 | `page_size: 200` — backend likely caps at 100. Stocks #101+ silently invisible. |
| MEDIUM | L72 | `distribution_date` default in UTC — late-night negative-UTC users see "tomorrow". |

### `not-found.tsx`

| Severity | Location | Issue |
|---|---|---|
| MEDIUM | L16 | `navigate(-1)` no-ops if 404 is first page in session. |
| LOW | L20 | "Back to Dashboard" not role-aware — USER role shouldn't land on dashboard. |

### `profile.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L93–111 | Error parsing uses `err.response.data.detail`; rest of app uses `.message`. Inconsistent → generic fallback always shown. |
| MEDIUM | L42 | No check that `newPassword !== currentPassword`. |
| MEDIUM | L39 | Min 8 chars but no complexity rules — backend may reject after submit. |
| MEDIUM | L78 | If user is null mid-session, profile renders with empty fields, no redirect. |
| LOW | L132 | `navigate(-1)` no-ops on direct URL load. |

### `reconciliation.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L327–329, L331–334 | "Approve Draft Adjustment" and "Create Adjustment" buttons have **no `onClick`** — dead. |
| HIGH | L100–103 | "Run Reconciliation" button just refetches the list — no server-side job triggered. Label "Running…" is misleading. |
| HIGH | L31–37 | `submitCount.mutate` has no `onError`. Save fails silently. |
| HIGH | L70–71 | CSV import loops sequentially with no batching, no progress UI. 1000 rows = 1000 sequential requests. |
| MEDIUM | L43 | CSV split via `.split(/\r?\n/)` doesn't handle quoted commas/newlines. |
| MEDIUM | L49–51 | Header column matching uses `includes("qty")` — "discount_qty" matches. |
| MEDIUM | L65 | Row with fewer columns than header counted as failure without row number reported. |
| MEDIUM | L107–110 | `handleCountSubmit` silently bails on invalid input — no toast. |
| MEDIUM | L25–29 | No `onError`. Backend down → "No active stocks found" forever. |

### `reports.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L225 | `<SelectItem value={opt.value \|\| "_all"}>` — "All" selection sends literal `"_all"` to backend as filter. Likely returns no rows. |
| CRITICAL | L214–218 | If a filter has no default selection, Select receives empty string — Radix disallows; trigger unstable. |
| HIGH | L142–146 | `useGetReport` runs on mount with no `enabled` gate — fetches before user clicks "Run Report". |
| HIGH | L148–150 | `handleRunReport` doesn't validate date ranges or required filters. |
| HIGH | L178–182 | On report switch, stale data from previous report renders for one frame. |
| MEDIUM | L152–166 | Export uses `activeFilters` — if user changes filters but doesn't click "Run Report", export ships old filters silently. |
| MEDIUM | L309 | `colSpan={reportData?.columns.length ?? 5}` — zero columns gives invalid colSpan=0. |
| MEDIUM | L141 | `availableReports` filter only excludes `adminOnly` in UI; non-admin can call API directly. |

### `stock-detail.tsx`

| Severity | Location | Issue |
|---|---|---|
| HIGH | L31–39 | No `isError` distinguishing 404 from network failure — shows same "Stock not found" empty. |
| MEDIUM | L11–15 | `useGetLedger({ stock_id: id ?? undefined })` runs without `enabled` gate when id is undefined — fetches global ledger. |
| MEDIUM | L188–189 | Top 20 ledger entries shown with no pagination / no "view all" link / no indication more exist. |
| MEDIUM | L200–201 | `qty_change === 0` renders "0" in red — misrepresents net-zero adjustments. |
| LOW | L47–49 | Back button `navigate(-1)` no-ops on direct URL load. |

### `stocks.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L375–382 | `RequestActivationDialog.handleSubmit` fake `setTimeout(800)` then toasts success. **Activation requests never reach backend.** |
| CRITICAL | L913–918 | `handleBulkAction` fake `setTimeout(600)` + toast. Bulk Activate/Deactivate do nothing. |
| CRITICAL | L1229–1232 | Row "Deactivate" icon button: fake setTimeout + toast. |
| CRITICAL | L1264–1267 | Row "Reactivate" icon button: fake setTimeout + toast. |
| CRITICAL | L829–832, L890–894 | `useListStocks({ page_size: 20 })` with **all** lifecycle filtering and pagination client-side over only 20 rows. Tab counts wrong for any tenant > 20 stocks. |
| HIGH | L1083–1086 | `SkeletonRows` renders 10 cols but table has 11 (checkbox+10). Skeleton in wrong columns during loading. |
| HIGH | L585–587 | Generic "Operation failed" — backend's `DUPLICATE_STOCK_CODE` / zod details never shown. |
| HIGH | L562–574 | When editing, form sends `total_qty: qty, available_qty: qty` from `opening_qty` — **overwrites real available/total** if reserved/distributed are non-zero. Silent data corruption. |
| HIGH | L1264–1281, L1037–1048 | "Reactivate" + bulk activate visible to all roles (no role gate in UI). |
| MEDIUM | L92–96 | `generateStockCode` uses `Math.random()` with no uniqueness check — concurrent users collide. |
| MEDIUM | L549 | Number input accepts decimals & scientific notation. |
| MEDIUM | L897–898 | `localPage` not clamped after filter changes — pages 5 of 2 shows empty rows until user clicks pagination. |
| MEDIUM | L378–381 | Toast `"Activation requested for ${stock?.name}"` shows `"undefined"` if stock is null at fire time. |

### `upload.tsx`

| Severity | Location | Issue |
|---|---|---|
| CRITICAL | L19, L54 | `accept=".xlsx,.xls,.csv"` only on click-to-browse; drag-drop accepts ANY file type. |
| HIGH | L32 | `dataTransfer.files[0]` silently truncates multi-file drops. |
| HIGH | L86–87 | Two progress bars with different semantics (save vs upload) — confusing. |
| HIGH | L165 | `useGetJobHistory` only refetches on 30s stale — newly completed job doesn't appear in history. |
| HIGH | — | **No file-size limit**. 500MB CSV hangs the browser before networking. |
| MEDIUM | L144 | Errors silently truncated to first 5 — no "show all". |
| MEDIUM | L162 | Stocks vs Distributions tabs share `isPending` — cross-tab interference. |

---

## Cross-cutting themes

### A. Silent failures everywhere
Most queries have no `isError` handling. Most mutations have no `onError`. The result: failed loads consistently render as "empty list", indistinguishable from a true empty result. **Recommendation:** add a global `QueryClient.onError` in `main.tsx` that toasts unexpected errors.

### B. Counts derived from filtered data
This pattern appears in `my-assets`, `my-requests`, `approvals`, `employees` department list — totals/badge counts are computed from the already-narrowed visible list, so they go to 0 when a filter is active. **Recommendation:** use the dedicated stats endpoint (`useGetRequestsStats` etc.) for counts; only use the filtered list for the visible rows.

### C. Fake mutations (`setTimeout` + toast)
At least eight buttons across `stocks.tsx`, `approvals.tsx`, `make-request.tsx` fake their work. These are residual scaffolding. **Recommendation:** grep for `setTimeout(.*toast` and wire to real endpoints (or hide the buttons until backend supports the action).

### D. Hardcoded Tailwind colors (`bg-red-500/20`, `text-green-400`)
Many constants and pages still use literal palette classes that don't follow theme. On the new Obsidian theme they read fine; on the Light preset they wash out. **Recommendation:** finish migration to `hsl(var(--success/warning/destructive))`.

### E. No debouncing on search inputs
`assets`, `audit-log`, `employees` (broken debouncer), `legal-holds`, `distributions`, `make-request` — every keystroke fires an API call. **Recommendation:** add a 300ms debounce helper and apply consistently.

### F. Client-side filtering over server-paginated data
`ledger`, `stocks`, `employees` (department), `approvals` (filters + sort + SLA computation) all do this. Results are wrong whenever total > visible page size. **Recommendation:** push filtering server-side, OR fetch a wider pool when feasible (as `new-distribution` does with `page_size: 200`).

### G. Recharts components don't filter NaN
Pie/bar/line charts in `dashboard` and `reports` don't sanitize `NaN` from data arrays — Recharts will skip points silently or render artifacts.

### H. Pagination state not URL-synced
`audit-log`, `admin/users`, `stocks`, `distributions`, `assets` — refreshing the page loses your position. **Recommendation:** sync page+filters to query string.

### I. Modal forms don't reset on close
`approvals` (reject/forward), `admin` (create-user), `assets` (create), `anomalies` (resolve) — opening for entity A, cancelling, then opening for entity B shows A's leftover form state. **Recommendation:** call `form.reset()` in the dialog's `onOpenChange` close branch.

### J. `as any` casts hide contract drift
`admin.tsx` L598/604/656/671/763 and `employee-detail.tsx` L260 use `as any` / `as { ... }` casts that bypass TypeScript. These are where API responses and frontend types are most likely to silently diverge.

### K. Polling never pauses on tab hidden
`useGetSystemHealth`, `useGetNotifications`, anomaly polling — all use `refetchInterval` with no `refetchIntervalInBackground: false`, so they keep firing while the tab isn't focused, wasting bandwidth and backend resources.

### L. No request `timeout`
`api.ts` axios instance has no timeout. Hung requests block the UI forever — particularly bad for file uploads on mobile.

### M. Auditor role is unhandled
`auditor` is in `ROLES.AUDITOR` and has a sidebar entry in `app-layout`, but `auth-context.tsx` has no `isAuditor` flag and no role-helper returns true for it. All role-gating treats auditors as "no role".

### N. Camera flows lack timeouts, progress, and specific error handling
`asset-audit` and `mobile-audit` both lump every `getUserMedia` error into "permission denied", have no upload-progress UI, no timeout on the fetch, and frozen countdown UI. Real mobile users will hit at least one of these.

### O. Approvals page-wide fabrication
The single biggest data-integrity bug. Approvers see fake risk scores, fake AI reasoning, fake stock-before/after, fake "8 previous requests" history, fake "12 auto-approved today" KPI. Their decisions are based on hash-derived numbers.

---

## Notes / Possible false positives from the agents

- **`cursor-glow.tsx`** was flagged as unused — it is in fact mounted in `login.tsx`. Agent missed the new import.
- **`notification-bell.tsx`, `theme-toggle.tsx`, `page-transition.tsx`** were flagged as unused — please verify with `grep` before deleting. These may be referenced by other entry points (e.g. mobile-only routes) or planned for future use.
- The **api.ts:74 refresh shape mismatch** is the single most consequential finding. It needs **verification against the actual backend response** before fixing — if the backend already returns `accessToken` (camelCase), then the frontend is fine and only the project memory note is out of date.
- A few "missing role guard" findings depend on backend RLS — if the API enforces per-role read access, the frontend-only sidebar hiding is acceptable as defense-in-depth (still recommended to add explicit guards).

---

## What was NOT verified (caveat)

- Live behavior against a running backend (no DB / Azure OpenAI access from here).
- Bundle size, lighthouse scores, real device testing.
- Backend-side bugs in `src/backend/src/routes/` — only spot-checked while validating frontend ↔ backend contracts.
- Real-time / WebSocket flows (if any).
- Accessibility against actual screen readers — only checked for obvious missing labels.

---

End of report.
