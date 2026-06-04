# Mavericks Inventory — Backend

Express.js REST API for the Mavericks Inventory Management System. Handles authentication, asset/stock management, distributions, approvals, anomaly detection, and Azure integrations.

## Tech Stack

- **Runtime**: Node.js 22 + TypeScript
- **Framework**: Express 5
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: JWT (access token) + refresh token via HTTP-only cookie
- **Azure**: OpenAI (GPT-4o), AI Search, Blob Storage

## Prerequisites

- Node.js 22+
- PostgreSQL 15+ (local or Azure Database for PostgreSQL)

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, and Azure credentials

# 3. Apply DB schema
npm run db:push

# 4. Seed demo data (creates 4 demo accounts)
npm run db:seed

# 5. Start dev server (hot-reload)
npm run dev
```

Server runs at `http://localhost:8080`.

## Demo Accounts (after seeding)

| Role           | Email                    | Password       |
|----------------|--------------------------|----------------|
| IT Employee    | employee@mavericks.com   | Employee@123!  |
| IT Manager     | manager@mavericks.com    | Manager@123!   |
| System Admin   | admin@mavericks.com      | Admin@123!     |
| L2 Authority   | l2@mavericks.com         | L2Auth@123!    |

## API

All routes are prefixed `/api/v1`. See route files in `src/routes/` for the full endpoint list.

## Build & Production

```bash
npm run build   # compiles TypeScript → dist/
npm start       # runs compiled output
```

## Docker

```bash
docker build -t mavericks-backend .
docker run -p 8080:8080 --env-file .env mavericks-backend
```

## Azure Hosting

Deploy as an **Azure Container App** or **Azure App Service (Linux container)**. Set all env vars from `.env.example` in the Azure portal under **Configuration → Application settings**.
