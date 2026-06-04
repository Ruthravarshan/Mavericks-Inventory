import { AzureOpenAI } from "openai";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

// Lazy-initialized clients — safe when Azure env vars are not yet configured
let _openai: AzureOpenAI | null = null;
let _searchClient: SearchClient<Record<string, unknown>> | null = null;

function getOpenAIClient(): AzureOpenAI | null {
  if (_openai) return _openai;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  if (!endpoint || !apiKey) return null;
  try {
    _openai = new AzureOpenAI({
      endpoint,
      apiKey,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview",
    });
    return _openai;
  } catch {
    return null;
  }
}

function getSearchClient(): SearchClient<Record<string, unknown>> | null {
  if (_searchClient) return _searchClient;
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const key = process.env.AZURE_SEARCH_KEY;
  if (!endpoint || !key) return null;
  try {
    _searchClient = new SearchClient<Record<string, unknown>>(
      endpoint,
      process.env.AZURE_SEARCH_INDEX ?? "mavericks-stocks",
      new AzureKeyCredential(key)
    );
    return _searchClient;
  } catch {
    return null;
  }
}

export interface AgentQueryResult {
  answer: string;
  sources: unknown[];
  confidence: "high" | "medium" | "low";
}

export async function runInventoryQuery(
  query: string,
  _context?: Record<string, unknown>
): Promise<AgentQueryResult> {
  const searchClient = getSearchClient();
  const openai = getOpenAIClient();

  // 1. Retrieve relevant inventory records from Azure AI Search
  const sources: unknown[] = [];
  if (searchClient) {
    const searchResults = await searchClient.search(query, { top: 5 });
    for await (const result of searchResults.results) {
      sources.push(result.document);
    }
  }

  // 2. Build grounded prompt and call Azure OpenAI
  const systemPrompt = `You are an AI assistant for Mavericks Inventory Management.
Answer questions about inventory, assets, stocks, and distributions.
Base your answer only on the provided inventory data. Be concise and factual.`;

  const userMessage = sources.length > 0
    ? `Inventory data:\n${JSON.stringify(sources, null, 2)}\n\nQuestion: ${query}`
    : `Question: ${query}\n\n(No matching inventory records found — answer from general knowledge if appropriate.)`;

  if (!openai) {
    return {
      answer: "AI query service is unavailable. Please check Azure OpenAI configuration.",
      sources,
      confidence: "low",
    };
  }

  const completion = await openai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 512,
    temperature: 0.2,
  });

  const answer = completion.choices[0]?.message?.content ?? "Unable to generate response.";
  const confidence = sources.length >= 3 ? "high" : sources.length >= 1 ? "medium" : "low";

  return { answer, sources, confidence };
}
