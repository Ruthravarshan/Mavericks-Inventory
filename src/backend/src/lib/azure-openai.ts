import { createHash } from "crypto";
import logger from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskAnalysisResult {
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendation: string;
  reasoning: string;
  confidence: number;
  flags: string[];
}

export interface ExcelRowError {
  rowNumber: number;
  field: string;
  errorType: string;
  message: string;
  value?: string;
}

export interface RowCorrection {
  rowNumber: number;
  field: string;
  original_value: string;
  corrected_value: string;
  reason: string;
}

export interface SelfHealResult {
  correctedRows: Record<string, unknown>[];
  errors: ExcelRowError[];
  corrections: RowCorrection[];
}

export interface AnomalyExplanation {
  explanation: string;
  recommendedAction: string;
  urgency: "low" | "medium" | "high";
}

export interface NLQueryResult {
  sql: string;
  queryType: string;
  explanation: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { value: unknown; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function cacheSet(key: string, value: unknown): void {
  cache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
}

function hashKey(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// ─── JSON extraction helper ───────────────────────────────────────────────────
// Models sometimes wrap their JSON in markdown code fences; this strips them.
function extractJSON(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  // Try to find the first '{' or '[' and return from there
  const firstBrace = raw.search(/[{[]/);
  return firstBrace >= 0 ? raw.slice(firstBrace) : raw;
}

// ─── Azure OpenAI client ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let openaiClient: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClient(): Promise<any> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;

  if (!endpoint || !key) {
    return null;
  }

  if (!openaiClient) {
    try {
      const { AzureOpenAI } = await import("openai");
      // @ts-ignore
      openaiClient = new AzureOpenAI({
        endpoint,
        apiKey: key,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-02-01",
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
      });
    } catch (err) {
      logger.error({ err }, "Failed to initialize Azure OpenAI client");
      return null;
    }
  }

  return openaiClient;
}

async function callOpenAIOnce(
  client: unknown,
  deployment: string,
  systemPrompt: string,
  userPrompt: string,
  useJsonMode: boolean
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  const params: Record<string, unknown> = {
    model: deployment,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  };
  if (useJsonMode) params.response_format = { type: "json_object" };

  const response = await c.chat.completions.create(params);
  const content: string | null = response.choices[0]?.message?.content ?? null;
  return content ? extractJSON(content) : null;
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 2
): Promise<string | null> {
  const client = await getClient();
  if (!client) return null;

  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
  let useJsonMode = true;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callOpenAIOnce(client, deployment, systemPrompt, userPrompt, useJsonMode);
      return result;
    } catch (err: unknown) {
      const errMsg = String((err as { message?: string }).message ?? "");
      // If JSON mode is not supported switch to plain text for remaining attempts
      if (useJsonMode && (errMsg.includes("response_format") || errMsg.includes("json_object") || errMsg.includes("not supported"))) {
        logger.warn("JSON mode not supported, switching to plain text");
        useJsonMode = false;
      } else if (attempt === maxRetries) {
        logger.error({ err, attempt }, "Azure OpenAI call failed after retries");
        return null;
      } else {
        logger.warn({ err, attempt }, "Azure OpenAI call failed, retrying");
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  return null;
}

// ─── 1. analyzeRisk ───────────────────────────────────────────────────────────

export async function analyzeRisk(
  distribution: {
    qtyRequested: number;
    recipientName: string;
    purpose?: string | null;
    recipientType: string;
  },
  recipientHistory: Array<{ qtyRequested: number; status: string }>,
  stockInfo: { stockName: string; availableQuantity: number; minStockLevel: number; category: string }
): Promise<RiskAnalysisResult> {
  const cacheKey = hashKey({ distribution, recipientHistory, stockInfo });
  const cached = cacheGet<RiskAnalysisResult>(cacheKey);
  if (cached) return cached;

  logger.info(
    { stockName: stockInfo.stockName, qty: distribution.qtyRequested },
    "analyzeRisk invoked"
  );

  const systemPrompt = `You are an inventory risk assessment AI for a government/enterprise system.
Analyze distribution requests and return a JSON risk assessment.
Return ONLY valid JSON with fields: riskScore (0-100), riskLevel ("Low"|"Medium"|"High"), recommendation (string), reasoning (string), confidence (0-1), flags (string[]).`;

  const userPrompt = `Analyze this distribution request:
Stock: ${stockInfo.stockName} (Category: ${stockInfo.category})
Available: ${stockInfo.availableQuantity}, Min Level: ${stockInfo.minStockLevel}
Requested Qty: ${distribution.qtyRequested}
Recipient: ${distribution.recipientName} (${distribution.recipientType})
Purpose: ${distribution.purpose ?? "Not specified"}
Recipient History (last 30 days): ${recipientHistory.length} prior requests, total qty ${recipientHistory.reduce((s, r) => s + r.qtyRequested, 0)}`;

  const aiResponse = await callOpenAI(systemPrompt, userPrompt);

  let result: RiskAnalysisResult;

  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse) as RiskAnalysisResult;
      result = {
        riskScore: Number(parsed.riskScore) || 0,
        riskLevel: parsed.riskLevel ?? "Low",
        recommendation: parsed.recommendation ?? "",
        reasoning: parsed.reasoning ?? "",
        confidence: Number(parsed.confidence) || 0.5,
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      };
    } catch {
      result = fallbackRiskAnalysis(distribution, stockInfo);
    }
  } else {
    result = fallbackRiskAnalysis(distribution, stockInfo);
  }

  cacheSet(cacheKey, result);
  return result;
}

function fallbackRiskAnalysis(
  distribution: { qtyRequested: number; purpose?: string | null },
  stockInfo: { availableQuantity: number; minStockLevel: number }
): RiskAnalysisResult {
  const { qtyRequested } = distribution;
  const { availableQuantity, minStockLevel } = stockInfo;

  let riskLevel: "Low" | "Medium" | "High" = "Low";
  let riskScore = 20;
  const flags: string[] = [];

  if (qtyRequested > 50) {
    riskLevel = "High";
    riskScore = 75;
    flags.push("Large quantity request");
  } else if (qtyRequested > 20) {
    riskLevel = "Medium";
    riskScore = 50;
    flags.push("Moderate quantity request");
  }

  const postDistQty = availableQuantity - qtyRequested;
  if (postDistQty < minStockLevel) {
    if (riskLevel !== "High") riskLevel = "High";
    riskScore = Math.max(riskScore, 80);
    flags.push("Would breach minimum stock level");
  }

  if (!distribution.purpose) {
    flags.push("No purpose specified");
    riskScore = Math.min(riskScore + 10, 100);
  }

  const recommendations: Record<string, string> = {
    Low: "Approve — low risk distribution within normal parameters.",
    Medium:
      "Review carefully before approving — moderate risk factors detected.",
    High: "Escalate for L2 approval — high risk factors detected.",
  };

  return {
    riskScore,
    riskLevel,
    recommendation: recommendations[riskLevel],
    reasoning: `Rule-based assessment: qty=${qtyRequested}, post-dist balance=${postDistQty.toFixed(2)}, min level=${minStockLevel}`,
    confidence: 0.7,
    flags,
  };
}

// ─── 2. selfHealExcelRows ─────────────────────────────────────────────────────

export async function selfHealExcelRows(
  rows: Record<string, unknown>[],
  uploadType: "stock_master" | "distribution"
): Promise<SelfHealResult> {
  const cacheKey = hashKey({ rows: rows.slice(0, 5), uploadType });
  const cached = cacheGet<SelfHealResult>(cacheKey);
  if (cached) return cached;

  logger.info({ rowCount: rows.length, uploadType }, "selfHealExcelRows invoked");

  const systemPrompt = `You are a data quality AI for an inventory management system.
Given Excel rows for ${uploadType}, identify errors and correct them where possible.
Return ONLY valid JSON: { correctedRows: [...], errors: [{rowNumber, field, errorType, message}] }`;

  const userPrompt = `Fix these ${uploadType} rows (first 50 shown):\n${JSON.stringify(rows.slice(0, 50), null, 2)}`;

  const aiResponse = await callOpenAI(systemPrompt, userPrompt);

  // Always run the deterministic rule engine — it produces aligned rows,
  // field-level corrections, and errors. If Azure returned usable rows we still
  // fold them in, but the rule engine is the source of truth for corrections so
  // the "Auto-Correct" feature works even when Azure is not configured.
  const result = fallbackValidateRows(rows, uploadType);

  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse) as {
        correctedRows?: Record<string, unknown>[];
        errors?: ExcelRowError[];
      };
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        // Merge any extra AI-detected errors (deduped by row+field).
        for (const e of parsed.errors) {
          if (!result.errors.some((x) => x.rowNumber === e.rowNumber && x.field === e.field)) {
            result.errors.push(e);
          }
        }
      }
    } catch {
      /* keep rule-engine result */
    }
  }

  cacheSet(cacheKey, result);
  return result;
}

// Canonical units of measure and common synonyms used for auto-correction.
const UOM_SYNONYMS: Record<string, string> = {
  pc: "Pieces", pcs: "Pieces", piece: "Pieces", pieces: "Pieces",
  unit: "Units", units: "Units", nos: "Units", no: "Units", qty: "Units",
  box: "Box", boxes: "Box", set: "Set", sets: "Set", pack: "Pack", packs: "Pack",
};

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fallbackValidateRows(
  rows: Record<string, unknown>[],
  uploadType: "stock_master" | "distribution"
): SelfHealResult {
  const errors: ExcelRowError[] = [];
  const corrections: RowCorrection[] = [];
  const correctedRows: Record<string, unknown>[] = [];

  const stockRequiredFields = ["stock_code", "stock_name", "category", "unit_of_measure"];
  const distRequiredFields = ["stock_code", "qty_requested", "recipient_name", "distribution_date"];
  const required = uploadType === "stock_master" ? stockRequiredFields : distRequiredFields;
  const numericFields =
    uploadType === "stock_master" ? ["opening_quantity", "min_stock_level"] : ["qty_requested"];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Excel row number (header = 1)
    // Keep rows aligned 1:1 with the input — never drop a row, so downstream
    // indices stay valid. Validity is signalled via the errors array.
    const corrected: Record<string, unknown> = { ...row };

    const record = (field: string, original: unknown, next: unknown, reason: string) => {
      if (String(original ?? "") !== String(next ?? "")) {
        corrections.push({
          rowNumber,
          field,
          original_value: String(original ?? ""),
          corrected_value: String(next ?? ""),
          reason,
        });
      }
      corrected[field] = next;
    };

    // 1) Trim all string values.
    for (const [k, v] of Object.entries(corrected)) {
      if (typeof v === "string" && v !== v.trim()) {
        record(k, v, v.trim(), "Trimmed surrounding whitespace");
      }
    }

    // 2) Field-specific normalisation.
    if (corrected["stock_code"] != null && String(corrected["stock_code"]).trim() !== "") {
      const up = String(corrected["stock_code"]).trim().toUpperCase();
      record("stock_code", corrected["stock_code"], up, "Standardised stock code to uppercase");
    }
    if (uploadType === "stock_master") {
      if (corrected["category"] != null && String(corrected["category"]).trim() !== "") {
        const tc = toTitleCase(String(corrected["category"]).trim());
        record("category", corrected["category"], tc, "Standardised category capitalisation");
      }
      if (corrected["unit_of_measure"] != null && String(corrected["unit_of_measure"]).trim() !== "") {
        const raw = String(corrected["unit_of_measure"]).trim();
        const canon = UOM_SYNONYMS[raw.toLowerCase()];
        if (canon) record("unit_of_measure", corrected["unit_of_measure"], canon, "Standardised unit of measure");
      }
    }

    // 3) Numeric coercion + sanity (negative → 0).
    for (const field of numericFields) {
      if (corrected[field] === undefined || corrected[field] === null || String(corrected[field]).trim() === "") {
        continue; // handled by required-field check below if required
      }
      const n = Number(corrected[field]);
      if (isNaN(n)) {
        errors.push({
          rowNumber,
          field,
          errorType: "INVALID_NUMBER",
          message: `Field '${field}' must be a numeric value`,
          value: String(corrected[field]),
        });
      } else {
        if (n < 0) {
          record(field, corrected[field], 0, "Negative quantity reset to 0");
        } else if (String(corrected[field]) !== String(n)) {
          record(field, corrected[field], n, "Converted to a number");
        } else {
          corrected[field] = n;
        }
      }
    }

    // 4) Required-field validation (after correction). Unfixable → error.
    for (const field of required) {
      const v = corrected[field];
      if (v === undefined || v === null || String(v).trim() === "") {
        errors.push({
          rowNumber,
          field,
          errorType: "MISSING_REQUIRED",
          message: `Required field '${field}' is missing`,
          value: "",
        });
      }
    }

    correctedRows.push(corrected);
  });

  return { correctedRows, errors, corrections };
}

// ─── 3. explainAnomaly ────────────────────────────────────────────────────────

export async function explainAnomaly(
  anomaly: {
    anomalyType: string;
    severity: string;
    description: string;
  },
  stockHistory: Array<{ movementType: string; quantity: number; performedAt: Date }>
): Promise<AnomalyExplanation> {
  const cacheKey = hashKey({ anomaly, history: stockHistory.slice(0, 10) });
  const cached = cacheGet<AnomalyExplanation>(cacheKey);
  if (cached) return cached;

  logger.info({ anomalyType: anomaly.anomalyType }, "explainAnomaly invoked");

  const systemPrompt = `You are an inventory intelligence AI. Explain anomalies in plain English.
Return ONLY valid JSON: { explanation: string, recommendedAction: string, urgency: "low"|"medium"|"high" }`;

  const userPrompt = `Explain this inventory anomaly:
Type: ${anomaly.anomalyType}
Severity: ${anomaly.severity}
Description: ${anomaly.description}
Recent stock movements (last 10): ${JSON.stringify(stockHistory.slice(0, 10))}`;

  const aiResponse = await callOpenAI(systemPrompt, userPrompt);

  let result: AnomalyExplanation;

  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse) as AnomalyExplanation;
      result = {
        explanation: parsed.explanation ?? anomaly.description,
        recommendedAction: parsed.recommendedAction ?? "Review and investigate",
        urgency: parsed.urgency ?? "medium",
      };
    } catch {
      result = fallbackAnomalyExplanation(anomaly);
    }
  } else {
    result = fallbackAnomalyExplanation(anomaly);
  }

  cacheSet(cacheKey, result);
  return result;
}

function fallbackAnomalyExplanation(anomaly: {
  anomalyType: string;
  severity: string;
  description: string;
}): AnomalyExplanation {
  const explanations: Record<string, AnomalyExplanation> = {
    low_stock: {
      explanation:
        "Stock levels have fallen below the minimum threshold, indicating a potential supply shortage that could disrupt operations.",
      recommendedAction:
        "Raise a procurement request immediately to replenish stock to optimal levels.",
      urgency: "high",
    },
    zero_stock: {
      explanation:
        "This item has completely run out of stock. Any pending distributions cannot be fulfilled.",
      recommendedAction:
        "Place an emergency procurement order and notify dependent departments.",
      urgency: "high",
    },
    velocity_anomaly: {
      explanation:
        "This stock item has been depleted significantly faster than its historical average, suggesting unusual consumption patterns.",
      recommendedAction:
        "Investigate recent distributions and verify legitimacy of large withdrawals.",
      urgency: "medium",
    },
    frequency_anomaly: {
      explanation:
        "An unusually high number of requests from the same recipient has been detected for this stock item.",
      recommendedAction:
        "Review recipient's recent request history and verify business justification.",
      urgency: "medium",
    },
    volume_anomaly: {
      explanation:
        "A single transaction has requested a quantity significantly above the average for this item.",
      recommendedAction:
        "Require additional approval and verify the stated purpose for this request.",
      urgency: "medium",
    },
  };

  return (
    explanations[anomaly.anomalyType] ?? {
      explanation: anomaly.description,
      recommendedAction: "Review and investigate this anomaly.",
      urgency: anomaly.severity === "critical" ? "high" : "medium",
    }
  );
}

// ─── 4. generateHealthNarrative ──────────────────────────────────────────────

export interface HealthNarrativeResult {
  summary: string;
  observations: string[];
  recommended_actions: string[];
}

export async function generateHealthNarrative(stats: {
  active: number;
  healthy: number;
  warning: number;
  critical: number;
  avgHealth: number;
  totalUnits: number;
  activeAnomalies: number;
  criticalAnomalies: number;
  criticalItems: Array<{ name: string; code: string; health: number; available: number; min: number }>;
}): Promise<HealthNarrativeResult | null> {
  const cacheKey = hashKey(stats);
  const cached = cacheGet<HealthNarrativeResult>(cacheKey);
  if (cached) return cached;

  logger.info({ active: stats.active, avgHealth: stats.avgHealth }, "generateHealthNarrative invoked");

  const systemPrompt = `You are an inventory intelligence assistant for an enterprise IT asset management system.
Analyze inventory health metrics and return a clear, actionable JSON report.
Return ONLY valid JSON with fields:
- summary: string (2-3 sentence executive summary, professional tone)
- observations: string[] (4-6 specific observations about the inventory state)
- recommended_actions: string[] (3-5 prioritized action items)`;

  const userPrompt = `Generate a health narrative for this inventory snapshot:
Total active stocks: ${stats.active}
Average health score: ${stats.avgHealth}/100
Healthy items: ${stats.healthy} (${Math.round((stats.healthy / Math.max(1, stats.active)) * 100)}%)
Warning items: ${stats.warning}
Critical items: ${stats.critical}
Total available units: ${stats.totalUnits}
Active anomalies: ${stats.activeAnomalies} (${stats.criticalAnomalies} critical)
${stats.criticalItems.length > 0 ? `\nWorst performing items:\n${stats.criticalItems.map(i => `- ${i.name} (${i.code}): health ${i.health}/100, ${i.available} units vs min ${i.min}`).join("\n")}` : ""}`;

  const aiResponse = await callOpenAI(systemPrompt, userPrompt);

  if (!aiResponse) return null;

  try {
    const parsed = JSON.parse(aiResponse) as HealthNarrativeResult;
    const result: HealthNarrativeResult = {
      summary: parsed.summary ?? "",
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [],
    };
    cacheSet(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ─── 5. naturalLanguageQuery ──────────────────────────────────────────────────

// Word-boundary patterns prevent false positives: "deleted_at" must not block "delete", "created_at" must not block "create"
const FORBIDDEN_SQL_WORDS = /\b(drop|delete|truncate|insert|update|alter|create|grant|revoke|execute)\b/i;
// These are never valid in a bare SELECT and have no legitimate column-name form
const FORBIDDEN_SQL_CHARS = /--/;

export async function naturalLanguageQuery(
  query: string,
  schemaContext: string
): Promise<NLQueryResult | null> {
  const cacheKey = hashKey({ query, schemaContext });
  const cached = cacheGet<NLQueryResult>(cacheKey);
  if (cached) return cached;

  logger.info({ query }, "naturalLanguageQuery invoked");

  const systemPrompt = `You are a PostgreSQL query assistant for an inventory management system.
Convert natural language questions to READ-ONLY SQL queries.
Schema context: ${schemaContext}
Rules:
- Only SELECT statements allowed
- No subqueries that modify data
- Always include LIMIT 100 unless aggregate query
- Return ONLY valid JSON: { sql: string, queryType: string, explanation: string }`;

  const userPrompt = `Convert to SQL: "${query}"`;

  const aiResponse = await callOpenAI(systemPrompt, userPrompt);

  if (!aiResponse) return null;

  try {
    const parsed = JSON.parse(aiResponse) as NLQueryResult;
    // Strip trailing semicolon — valid SQL but triggers the ; guard below
    const sql = (parsed.sql ?? "").replace(/;\s*$/, "");

    // Validate SQL is read-only
    if (FORBIDDEN_SQL_WORDS.test(sql) || FORBIDDEN_SQL_CHARS.test(sql)) {
      logger.warn({ sql }, "Dangerous keyword or chars detected in AI SQL");
      return null;
    }

    if (!sql.trim().toLowerCase().startsWith("select")) {
      logger.warn({ sql }, "AI returned non-SELECT statement");
      return null;
    }

    const result: NLQueryResult = {
      sql,
      queryType: parsed.queryType ?? "SELECT",
      explanation: parsed.explanation ?? query,
    };

    cacheSet(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
