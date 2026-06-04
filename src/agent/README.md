# Mavericks Inventory — Agent

Standalone AI agent service for the Mavericks Inventory Management System. Exposes an HTTP API that the backend calls to answer natural language inventory queries, grounded in Azure AI Search results.

## How it fits

```
Frontend  →  Backend (REST)  →  Agent (HTTP)  →  Azure OpenAI + AI Search
```

The backend calls `POST /query` with a natural language question. The agent:
1. Searches Azure AI Search for relevant inventory records
2. Constructs a grounded prompt
3. Calls Azure OpenAI (GPT-4o)
4. Returns the answer + source documents + confidence level

## Tech Stack

- **Runtime**: Node.js 22 + TypeScript
- **Framework**: Express 5
- **Azure**: OpenAI (GPT-4o), AI Search

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in AZURE_OPENAI_* and AZURE_SEARCH_* values

# 3. Start dev server
npm run dev
```

Agent runs at `http://localhost:9090`.

## Endpoints

| Method | Path      | Description                      |
|--------|-----------|----------------------------------|
| GET    | /health   | Health check                     |
| POST   | /query    | Run a natural language query     |

### POST /query

Request:
```json
{ "query": "How many laptops are available in Warehouse A?" }
```

Response:
```json
{
  "answer": "There are 12 available laptops in Warehouse A.",
  "sources": [...],
  "confidence": "high"
}
```

## Docker

```bash
docker build -t mavericks-agent .
docker run -p 9090:9090 --env-file .env mavericks-agent
```

## Azure Hosting

Deploy as an **Azure Container App** (internal ingress only — the backend calls it privately). Set all env vars from `.env.example` in the Azure portal.
