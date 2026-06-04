# Mavericks Inventory — Frontend

React + Vite SPA for the Mavericks Inventory Management System. Communicates with the backend via REST API. Role-based UI for IT Employees, IT Managers, System Admins, and L2 Authority.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build tool**: Vite 6
- **Routing**: React Router 7
- **Data fetching**: TanStack Query v5
- **UI**: Radix UI primitives + Tailwind CSS v4
- **Forms**: React Hook Form + Zod

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173`. In dev, Vite proxies all `/api` requests to `http://localhost:8080` (the backend). **The backend must be running for login and all data to work.**

## Login

The login page has **Quick Access** demo buttons that pre-fill the email/password fields. You still need to click **AUTHENTICATE**, which calls the real backend. Login will fail if the backend is not running.

| Role           | Email                    | Password       |
|----------------|--------------------------|----------------|
| IT Employee    | employee@example.com     | DemoPass!123   |
| IT Manager     | manager@example.com      | DemoPass!123   |
| System Admin   | admin@example.com        | DemoPass!123   |
| L2 Authority   | l2@example.com           | DemoPass!123   |

## Build & Production

```bash
npm run build   # outputs to dist/
```

## Docker (nginx)

```bash
docker build -t mavericks-frontend .
docker run -p 80:80 mavericks-frontend
```

The included `nginx.conf` serves the SPA and proxies `/api` → backend. Update the `proxy_pass` URL in `nginx.conf` before building for production.

## Azure Hosting

Deploy `dist/` to **Azure Static Web Apps** or use the Docker image on **Azure Container Apps**. For Static Web Apps, configure API proxying in `staticwebapp.config.json` to forward `/api/*` to your backend URL.
