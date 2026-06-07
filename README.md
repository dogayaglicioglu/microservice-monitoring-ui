# ObserveX — Microservice Monitoring Dashboard

A production-style observability dashboard built with React + Tailwind CSS, inspired by Grafana and Datadog.

**Live demo → [microservice-monitoring-ui.vercel.app](https://microservice-monitoring-ui.vercel.app)**

![Dashboard Screenshot](docs/screenshot.png)

## Features

- **KPI Cards** — total requests, error rate, avg latency, active services
- **Service Health Table** — expandable rows with version, region, instance details
- **Alert System** — bell icon with configurable latency/error rate/uptime thresholds; fires webhooks on breach
- **Live Charts** — requests/second (line) and latency over time (area) with per-service toggle and time range selector (15m / 30m / 1h)
- **Real-time updates** — SSE stream pushes chart data every 10 seconds without polling
- **Log Explorer** — filterable log stream by level (INFO / WARN / ERROR / DEBUG) with search
- **Services Page** — expanded per-service cards with uptime bar and instance details
- **Topology** — service dependency graph with live health status coloring
- **Search** — filters service table and logs simultaneously
- **Prometheus adapter** — reads metrics from an existing Prometheus instead of scraping `/metrics` endpoints

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

Everything you need is in this repo — the dashboard frontend and the aggregator (a small Go server that scrapes your services) live side by side.

There are two ways to run it:

### Option A — Docker (recommended, no Go needed)

Point the `SERVICES` variable at your running services, then:

```bash
SERVICES=my-api=http://host.docker.internal:3001,my-worker=http://host.docker.internal:3002 \
  docker compose up --build
```

Dashboard opens at [http://localhost:3000](http://localhost:3000). That's it — no `.env` file, no code changes.

> `host.docker.internal` resolves to your host machine from inside Docker. If your services are also in Docker, use their container names instead.

### Option B — Run locally (dev mode)

```bash
# Terminal 1 — aggregator
cd aggregator
SERVICES=my-api=http://localhost:3001,my-worker=http://localhost:3002 go run .
# runs on :4000

# Terminal 2 — dashboard
echo "VITE_USE_MOCK=false" >> .env.local
echo "VITE_API_BASE=http://localhost:4000" >> .env.local
npm run dev
# runs on :5173
```

---

### 1. Add endpoints to each of your services

> **Shortcut:** Copy the ready-made middleware from [`examples/`](examples/) for your stack (Go/gin, Node.js/Express, Python/FastAPI). Drop the file in, call `register` once — done.

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

`version`, `region`, and `uptime` are displayed as-is in the Service Health table and service cards.

### 2. Start the aggregator

The aggregator lives in [`aggregator/`](aggregator/) — no separate repo needed.

```bash
# name=url pairs, comma-separated — add as many services as you need
export SERVICES=auth-service=http://localhost:3001,order-service=http://localhost:3002

cd aggregator && go run .
# Runs on :4000
```

The aggregator scrapes all listed services in parallel. If `SERVICES` is not set it falls back to `auth-service=http://localhost:3001,order-service=http://localhost:3002`.

**Optional aggregator env vars:**

| Env var | Purpose |
|---|---|
| `WEBHOOK_URL` | POST here when an alert threshold is breached |
| `TOPOLOGY` | Dependency edges, e.g. `auth→order,order→payment` |
| `PROMETHEUS_URL` | Read metrics from Prometheus instead of scraping `/metrics` |
| `PROMETHEUS_LABEL_SERVICE` | Prometheus label that maps to service name (default: `service`) |

### 3. Connect the dashboard

```bash
# .env.local
VITE_USE_MOCK=false
VITE_API_BASE=http://localhost:4000

# Optional: set your Jaeger URL to make trace IDs in the Log Explorer clickable
# VITE_JAEGER_URL=http://localhost:16686
```

Restart the dev server — the dashboard now shows your real service data. No code changes needed.

> **Trace ID links** — if `VITE_JAEGER_URL` is set, every trace ID in the Log Explorer becomes a clickable link that opens the trace directly in Jaeger. Without it, trace IDs are shown as plain text. Any Jaeger-compatible UI works (Grafana Tempo, etc.) as long as it uses the `/trace/{id}` URL pattern.

### 4. Add a log endpoint to each service

The dashboard's Log Explorer tab calls `GET /logs` on each service (via the aggregator). Each service must expose this endpoint returning an array of log entries:

**`GET /logs`**
```json
[
  {
    "id": "auth-service-42",
    "timestamp": "2024-01-15T10:30:00.123Z",
    "service": "auth-service",
    "level": "INFO",
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "message": "Token validated successfully"
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | unique per entry, e.g. `"service-name-42"` |
| `timestamp` | string | ISO 8601 — used to sort the merged stream |
| `service` | string | displayed in the log table |
| `level` | string | `INFO` `WARN` `ERROR` `DEBUG` |
| `traceId` | string | links log entries to traces; use your OTel trace ID or any hex string |
| `message` | string | the log message |

Return entries newest-first, capped at ~200. The aggregator merges all services' log streams and re-sorts by timestamp before serving `/api/logs`.

**Connecting an existing logger**

Most structured loggers can write a middleware that appends to an in-memory ring buffer:

```go
// Go — slog / zap / logrus: extract the OTel trace ID and append to your buffer
traceID := trace.SpanFromContext(ctx).SpanContext().TraceID().String()
```

```js
// Node.js — pino / winston: pull the trace ID from your OTel SDK
const { trace } = require('@opentelemetry/api')
const traceId = trace.getActiveSpan()?.spanContext().traceId ?? crypto.randomUUID()
```

```python
# Python — structlog / logging: same pattern
from opentelemetry import trace
trace_id = format(trace.get_current_span().get_span_context().trace_id, '032x')
```

**Forwarding from an existing log aggregator**

If you already ship logs to Loki, Elasticsearch, or CloudWatch, you can write a thin adapter that queries those systems and reshapes the response into the schema above. The aggregator polls `/logs` on a schedule, so your adapter just needs to be a reachable HTTP endpoint.

### Alert thresholds

Default thresholds:

| Metric | Warning | Critical |
|---|---|---|
| Latency | > 300ms | > 500ms |
| Error rate | > 2% | > 5% |
| Uptime | < 99% | — |
| Status | degraded | down |

Click the ⚙️ icon in the top bar to edit thresholds — values are saved in the browser.

To also receive webhook notifications when a threshold is breached, set `WEBHOOK_URL` on the aggregator (any HTTP endpoint; Slack incoming webhooks work out of the box). A 5-minute debounce per service/metric prevents alert storms.

```bash
WEBHOOK_URL=https://hooks.slack.com/services/... \
SERVICES=... go run ./aggregator
```

Threshold env vars on the aggregator (optional, override defaults):

| Env var | Default |
|---|---|
| `THRESHOLD_LATENCY_WARN` | 300 |
| `THRESHOLD_LATENCY_CRIT` | 500 |
| `THRESHOLD_ERROR_WARN` | 2 |
| `THRESHOLD_ERROR_CRIT` | 5 |
| `THRESHOLD_UPTIME` | 99 |

---

## API contract

| Endpoint | Returns |
|---|---|
| `GET /api/kpis` | `{ totalRequests, errorRate, avgLatency, activeServices }` |
| `GET /api/services` | array of service health objects |
| `GET /api/metrics/rps?points=N` | time-series RPS per service (default 90 points = 15 min) |
| `GET /api/metrics/latency?points=N` | time-series latency per service |
| `GET /api/logs?limit=200` | merged log entries from all services |
| `GET /api/stream` | SSE stream — pushes a snapshot every 10 seconds |
| `GET /api/topology` | `{ nodes: string[], edges: [{source, target}] }` |

`?points=N` accepts 1–360 (360 points × 10 s = 1 hour).

Full type shapes are in [`src/data/mockData.js`](src/data/mockData.js).

---

## OpenTelemetry / Distributed Tracing

The bundled Go services ship with [OpenTelemetry](https://opentelemetry.io) instrumentation via `otelgin`. Every HTTP request gets a real trace ID that is automatically attached to log entries — so you can correlate a log line in the dashboard back to a full trace in Jaeger.

### Running with Jaeger (full trace UI)

```bash
docker compose up
```

This starts the dashboard + aggregator. To also spin up an **OTel Collector** and **Jaeger**, add the collector and Jaeger services to [`docker-compose.yml`](docker-compose.yml) — set `OTEL_EXPORTER_OTLP_ENDPOINT=otel-collector:4318` on the aggregator and point your own services at the same collector. Jaeger UI will be at [http://localhost:16686](http://localhost:16686).

Each service reads `OTEL_EXPORTER_OTLP_ENDPOINT` to decide where to ship spans. Without it, spans are still created (so log entries get real trace IDs) but are discarded.

### Adding OTel to your own service

Install the SDK for your language, then wrap your HTTP server. The Go pattern used here:

```go
// 1. init once at startup
tp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter), ...)
otel.SetTracerProvider(tp)

// 2. middleware on your router
r.Use(otelgin.Middleware("your-service-name"))

// 3. extract trace ID from request context for log entries
span := trace.SpanFromContext(c.Request.Context())
traceID := span.SpanContext().TraceID().String()
```

The same pattern exists for Node.js (`@opentelemetry/sdk-node`), Python (`opentelemetry-sdk`), and Java (`opentelemetry-java`). Point `OTEL_EXPORTER_OTLP_ENDPOINT` at the collector and traces flow through automatically.

---

## Roadmap

Current architecture uses a **pull model** — the aggregator polls each service's `/health`, `/metrics`, and `/logs` endpoints every 10 seconds. This is intentionally simple: add three endpoints, get a working dashboard.

The following would take this further:

- [x] **More than 2 services** — aggregator reads `SERVICES=name=url,...` so any number of services can be monitored without code changes.
- [x] **SSE push** — `/api/stream` pushes chart data every 10 seconds; frontend uses EventSource instead of polling.
- [x] **Alerting webhooks** — `WEBHOOK_URL` env var; POST to Slack/PagerDuty when a threshold is breached, with 5-minute debounce.
- [x] **Configurable alert thresholds** — editable via ⚙️ UI, saved in browser; also overridable via aggregator env vars.
- [x] **Time range selector** — 15m / 30m / 1h chart window; aggregator stores up to 1 hour of history.
- [x] **Prometheus adapter** — set `PROMETHEUS_URL` to read metrics from an existing Prometheus instead of scraping `/metrics`.
- [x] **Topology page** — `TOPOLOGY=a→b,b→c` env var; SVG dependency graph with live health coloring.
- [ ] **Native OTLP log ingestion** — accept logs pushed via OTLP; would need a log storage backend (e.g. Loki).
- [ ] **Grafana Tempo / Zipkin support** — `VITE_TRACE_BACKEND=tempo|jaeger|zipkin` flag to adapt trace link URL format.

---

## Project Structure

```
aggregator/
  main.go                        # Go aggregator — scrapes services, serves /api/*
  Dockerfile                     # Multi-stage build (golang:alpine → alpine)
examples/
  go-gin/observex.go             # Drop-in middleware for Go/gin services
  node-express/observex.js       # Drop-in middleware for Node.js/Express services
  python-fastapi/observex.py     # Drop-in middleware for Python/FastAPI services
src/
  App.jsx                        # Root — mock/real/SSE provider selection
  hooks/
    useDashboardData.js          # Polling data fetcher (VITE_USE_SSE=false)
    useSSEData.js                # SSE-based real-time data hook
    useAlertThresholds.js        # Alert threshold state + localStorage persistence
    useTopology.js               # One-shot fetch from /api/topology
  data/
    mockData.js                  # Simulated data (used when VITE_USE_MOCK != "false")
  components/
    layout/
      Sidebar.jsx                # Nav sidebar (Dashboard / Services / Logs / Topology)
      Topbar.jsx                 # Search + alert bell + ⚙️ threshold editor + refresh
    dashboard/
      KPICard.jsx                # Single metric card
      ServiceTable.jsx           # Health table with expandable rows
      RequestChart.jsx           # Recharts line chart with per-service toggle
      LatencyChart.jsx           # Recharts area chart with per-service toggle
      LogsPanel.jsx              # Filterable log stream
      TimeRangeSelector.jsx      # 15m / 30m / 1h chart window picker
    settings/
      ThresholdEditor.jsx        # Modal for editing alert thresholds
  pages/
    Dashboard.jsx                # Main dashboard layout
    Services.jsx                 # Expanded per-service cards
    Logs.jsx                     # Full-page log explorer
    Topology.jsx                 # SVG dependency graph with live health coloring
Dockerfile                       # Frontend — builds React, serves via nginx
nginx.conf                       # Proxies /api/* → aggregator, serves SPA
docker-compose.yml               # Starts aggregator + dashboard together
```
