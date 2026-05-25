import { db } from "../db/index.js";
import { stocks } from "../db/schema/index.js";
import { ilike, or, isNull, eq } from "drizzle-orm";
import logger from "./logger.js";

const isAzureConfigured = (): boolean =>
  !!(process.env.AZURE_SEARCH_ENDPOINT && process.env.AZURE_SEARCH_KEY);

const INDEX_NAME =
  process.env.AZURE_SEARCH_INDEX ?? "mavericks-stocks";

interface StockSearchDoc {
  id: string;
  stockCode: string;
  stockName: string;
  category: string;
  subCategory?: string;
  location?: string;
  description?: string;
  status: string;
  availableQuantity: number;
}

async function getSearchClient(): Promise<import("@azure/search-documents").SearchClient<StockSearchDoc> | null> {
  if (!isAzureConfigured()) return null;

  try {
    const { SearchClient, AzureKeyCredential } = await import(
      "@azure/search-documents"
    );
    const client = new SearchClient<StockSearchDoc>(
      process.env.AZURE_SEARCH_ENDPOINT!,
      INDEX_NAME,
      new AzureKeyCredential(process.env.AZURE_SEARCH_KEY!)
    );
    return client;
  } catch (err) {
    logger.error({ err }, "Failed to initialize Azure Search client");
    return null;
  }
}

async function getIndexClient(): Promise<import("@azure/search-documents").SearchIndexClient | null> {
  if (!isAzureConfigured()) return null;

  try {
    const { SearchIndexClient, AzureKeyCredential } = await import(
      "@azure/search-documents"
    );
    return new SearchIndexClient(
      process.env.AZURE_SEARCH_ENDPOINT!,
      new AzureKeyCredential(process.env.AZURE_SEARCH_KEY!)
    );
  } catch (err) {
    logger.error({ err }, "Failed to initialize Azure Search index client");
    return null;
  }
}

export async function ensureIndexExists(): Promise<void> {
  const indexClient = await getIndexClient();
  if (!indexClient) return;

  try {
    const index = {
      name: INDEX_NAME,
      fields: [
        { name: "id", type: "Edm.String" as const, key: true, searchable: false },
        { name: "stockCode", type: "Edm.String" as const, searchable: true, filterable: true },
        { name: "stockName", type: "Edm.String" as const, searchable: true, filterable: true },
        { name: "category", type: "Edm.String" as const, searchable: true, filterable: true },
        { name: "subCategory", type: "Edm.String" as const, searchable: true, filterable: true },
        { name: "location", type: "Edm.String" as const, searchable: true, filterable: true },
        { name: "description", type: "Edm.String" as const, searchable: true },
        { name: "status", type: "Edm.String" as const, searchable: false, filterable: true },
        { name: "availableQuantity", type: "Edm.Double" as const, searchable: false, filterable: true, sortable: true },
      ],
    };

    await indexClient.createOrUpdateIndex(index);
    logger.info({ indexName: INDEX_NAME }, "Azure Search index ensured");
  } catch (err) {
    logger.error({ err }, "Failed to create/update Azure Search index");
  }
}

export async function indexStockItem(stock: {
  id: number;
  stockCode: string;
  stockName: string;
  category: string;
  subCategory?: string | null;
  location?: string | null;
  description?: string | null;
  status: string;
  availableQuantity: number;
}): Promise<void> {
  const client = await getSearchClient();

  if (!client) {
    logger.debug("Azure Search not configured, skipping index");
    return;
  }

  try {
    const doc: StockSearchDoc = {
      id: String(stock.id),
      stockCode: stock.stockCode,
      stockName: stock.stockName,
      category: stock.category,
      subCategory: stock.subCategory ?? undefined,
      location: stock.location ?? undefined,
      description: stock.description ?? undefined,
      status: stock.status,
      availableQuantity: stock.availableQuantity,
    };

    await client.mergeOrUploadDocuments([doc]);
    logger.debug({ stockId: stock.id }, "Stock item indexed in Azure Search");
  } catch (err) {
    logger.error({ err, stockId: stock.id }, "Failed to index stock item");
  }
}

export async function searchStocks(query: string): Promise<typeof stocks.$inferSelect[]> {
  const client = await getSearchClient();

  if (!client) {
    // Fallback: DB full-text search
    return fallbackSearchStocks(query);
  }

  try {
    const searchResults = await client.search(query, {
      top: 50,
      select: ["id"],
    });

    const ids: number[] = [];
    for await (const result of searchResults.results) {
      ids.push(Number(result.document.id));
    }

    if (ids.length === 0) return [];

    const dbResults = await db
      .select()
      .from(stocks)
      .where(
        // Filter by matched IDs
        isNull(stocks.deletedAt)
      )
      .limit(50);

    return dbResults.filter((s) => ids.includes(s.id));
  } catch (err) {
    logger.error({ err, query }, "Azure Search query failed, falling back to DB");
    return fallbackSearchStocks(query);
  }
}

async function fallbackSearchStocks(query: string): Promise<typeof stocks.$inferSelect[]> {
  const searchTerm = `%${query}%`;
  return db
    .select()
    .from(stocks)
    .where(
      or(
        ilike(stocks.stockName, searchTerm),
        ilike(stocks.stockCode, searchTerm),
        ilike(stocks.category, searchTerm),
        ilike(stocks.description ?? stocks.stockName, searchTerm)
      )
    )
    .limit(50);
}

export async function deleteIndex(id: number): Promise<void> {
  const client = await getSearchClient();
  if (!client) return;

  try {
    await client.deleteDocuments([{ id: String(id) }]);
    logger.debug({ stockId: id }, "Stock item removed from Azure Search index");
  } catch (err) {
    logger.error({ err, stockId: id }, "Failed to delete from Azure Search index");
  }
}
