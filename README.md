# ObserveX — Microservice Monitoring Dashboard

A production-style observability dashboard built with React + Tailwind CSS, inspired by Grafana and Datadog.

**Live demo → [microservice-monitoring-ui.vercel.app](https://microservice-monitoring-ui.vercel.app)**

![Dashboard Screenshot](docs/screenshot.png)

## Features

- **KPI Cards** — total requests, error rate, avg latency, active services
- **Service Health Table** — expandable rows with version, region, instance details
- **Alert System** — bell icon shows live warnings/criticals based on latency, error rate and uptime thresholds
- **Live Charts** — requests/second (line) and latency over time (area) with per-service toggle
- **Log Explorer** — filterable log stream by level (INFO / WARN / ERROR / DEBUG) with search
- **Services Page** — expanded per-service cards with uptime bar and instance details
- **Search** — filters service table and logs simultaneously
- **Auto-refresh** — polls the API every 15 seconds when connected to a real backend

## Tech Stack

- [React 19](https://react.dev) + [Vite](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Recharts](https://recharts.org) — charts
- [Lucide React](https://lucide.dev) — icons

---

## Quick Start (mock data, no backend needed)

```bash
git clone https://github.com/dogayaglicioglu/microservice-monitoring-ui
cd microservice-monitoring-ui
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Works out of the box with simulated data.

---

## Connecting Your Own Services

To monitor real services, you need two things:

### 1. Add endpoints to each of your services

Every service you want to monitor must expose these two endpoints:

**`GET /health`**
```json
{
  "service": "your-service-name",
  "status": "healthy",
  "version": "v1.0.0",
  "region": "us-east-1",
  "uptime": 99.95
}
```

**`GET /metrics`**
```json
{
  "rps": 120,
  "latency": 45,
  "errorRate": 0.3,
  "totalReqs": 1500000
}
```

`status` must be one of: `healthy` `degraded` `down`

### 2. Run the aggregator

The aggregator is a small Go server that scrapes your services and exposes a unified API for the dashboard.

```bash
git clone https://github.com/dogayaglicioglu/observex-backend
cd observex-backend/aggregator

# Point it at your services
export AUTH_SERVICE_URL=http://your-auth-service:3001
export ORDER_SERVICE_URL=http://your-order-service:3002

go run .
# Runs on :4000
```

> Don't have Go? The aggregator has a Dockerfile — run it with `docker build` instead.

### 3. Connect the dashboard

```bash
# .env.local
VITE_API_BASE=http://localhost:4000
```

Then in [`src/App.jsx`](src/App.jsx), change:
```js
const USE_MOCK = false
```

Restart the dev server — the dashboard now shows your real service data.

### Alert thresholds

The bell icon auto-generates alerts based on these rules:

| Metric | Warning | Critical |
|---|---|---|
| Latency | > 300ms | > 500ms |
| Error rate | > 2% | > 5% |
| Uptime | < 99% | — |
| Status | degraded | down |

---

## API contract

The dashboard expects these endpoints from the aggregator:

| Endpoint | Returns |
|---|---|
| `GET /api/kpis` | `{ totalRequests, errorRate, avgLatency, activeServices }` |
| `GET /api/services` | array of service health objects |
| `GET /api/metrics/rps` | time-series RPS per service (last 30 points) |
| `GET /api/metrics/latency` | time-series latency per service (last 30 points) |
| `GET /api/logs?limit=200` | merged log entries from all services |

Full type shapes are in [`src/data/mockData.js`](src/data/mockData.js).

---

## Project Structure

```
src/
  App.jsx                        # Root — owns page state, USE_MOCK switch
  hooks/
    useDashboardData.js          # Fetches all endpoints, polls every 15s
  data/
    mockData.js                  # Simulated data (used when USE_MOCK=true)
  components/
    layout/
      Sidebar.jsx                # Nav sidebar
      Topbar.jsx                 # Search + alert bell + refresh
    dashboard/
      KPICard.jsx                # Single metric card
      ServiceTable.jsx           # Health table with expandable rows
      RequestChart.jsx           # Recharts line chart with service toggle
      LatencyChart.jsx           # Recharts area chart with service toggle
      LogsPanel.jsx              # Filterable log stream
  pages/
    Dashboard.jsx                # Main dashboard layout
    Services.jsx                 # Expanded service cards
    Logs.jsx                     # Full-page log explorer
```
