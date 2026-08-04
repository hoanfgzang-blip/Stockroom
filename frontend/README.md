# WMS Frontend

React + Vite + Tailwind dashboard for the Warehouse & Logistics Management System. Connects to the ASP.NET Core REST API.

## Prerequisites

- Node.js 18+
- WMS API running at `http://localhost:5295`

## Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The Vite dev server proxies `/api` requests to the backend. To point at a different API host, set:

```env
VITE_API_URL=http://localhost:5295/api
```

## Production build

```bash
npm run build
npm run preview
```

## Screens

| Route | Feature |
|-------|---------|
| `/` | Dashboard KPIs, charts, alerts |
| `/infrastructure/*` | Provinces, locations, zones, pallets |
| `/inventory/*` | Inbound/outbound orders, sacks, reservations |
| `/logistics/*` | Fleet, trip kanban |
| `/hr/*` | Employees, shifts |
| `/audit-logs` | Compliance audit trail with JSON diff |
