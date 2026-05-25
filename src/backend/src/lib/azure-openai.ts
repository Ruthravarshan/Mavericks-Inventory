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
}

export interface SelfHealResult {
  correctedRows: Record<string, unknown>[];
  errors: ExcelRowError[];
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

// ─── Azure OpenAI client ──────────────────────────────────────────────────────

let openaiClient: import("@azure/openai").AzureOpenAI | null = null;

async function getClient(): Promise<import("@azure/openai").AzureOpenAI | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;

  if (!endpoint || !key) {
    return null;
  }

  if (!openaiClient) {
    try {
      const { AzureOpenAI } = await import("@azure/openai");
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

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const client = await getClient();
  if (!client) return null;

  try {
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    return response.choices[0]?.message?.content ?? null;
  } catch (err) {
    logger.error({ err }, "Azure OpenAI call failed");
    return null;
  }
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

  let result: SelfHealResult;

  if (aiResponse) {
    try {
      const parsed = JSON.parse(aiResponse) as {
        correctedRows?: Record<string, unknown>[];
        errors?: ExcelRowError[];
      };
      result = {
        correctedRows: Array.isArray(parsed.correctedRows)
          ? parsed.correctedRows
          : rows,
        errors: Array.isArray(parsed.errors) ? parsed.errors : [],
      };
    } catch {
      result = fallbackValidateRows(rows, uploadType);
    }
  } else {
    result = fallbackValidateRows(rows, uploadType);
  }

  cacheSet(cacheKey, result);
  return result;
}

function fallbackValidateRows(
  rows: Record<string, unknown>[],
  uploadType: "stock_master" | "distribution"
): SelfHealResult {
  const errors: ExcelRowError[] = [];
  const correctedRows: Record<string, unknown>[] = [];

  const stockRequiredFields = [
    "stock_code",
    "stock_name",
    "category",
    "unit_of_measure",
  ];
  const distRequiredFields = [
    "stock_code",
    "qty_requested",
    "recipient_name",
    "distribution_date",
  ];
  const required =
    uploadType === "stock_master" ? stockRequiredFields : distRequiredFields;

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Excel row number (header = 1)
    const corrected = { ...row };
    let hasError = false;

    for (const field of required) {
      if (
        row[field] === undefined ||
        row[field] === null ||
        String(row[field]).trim() === ""
      ) {
        errors.push({
          rowNumber,
          field,
          errorType: "MISSING_REQUIRED",
          message: `Required field '${field}' is missing`,
        });
        hasError = true;
      }
    }

    const numericFields =
      uploadType === "stock_master"
        ? ["opening_quantity", "min_stock_level"]
        : ["qty_requested"];

    for (const field of numericFields) {
      if (row[field] !== undefined && isNaN(Number(row[field]))) {
        errors.push({
          rowNumber,
          field,
          errorType: "INVALID_NUMBER",
          message: `Field '${field}' must be a numeric value`,
        });
        hasError = true;
      } else if (row[field] !== undefined) {
        corrected[field] = Number(row[field]);
      }
    }

    if (!hasError) {
      correctedRows.push(corrected);
    }
  });

  return { correctedRows, errors };
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

// ─── 4. naturalLanguageQuery ──────────────────────────────────────────────────

const FORBIDDEN_KEYWORDS = [
  "drop",
  "delete",
  "truncate",
  "insert",
  "update",
  "alter",
  "create",
  "grant",
  "revoke",
  "exec",
  "execute",
  "--",
  ";",
];

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
    const sql = parsed.sql ?? "";

    // Validate SQL is read-only
    const lowerSql = sql.toLowerCase();
    for (const keyword of FORBIDDEN_KEYWORDS) {
      if (lowerSql.includes(keyword)) {
        logger.warn({ sql, keyword }, "Dangerous keyword detected in AI SQL");
        return null;
      }
    }

    if (!lowerSql.trim().startsWith("select")) {
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
