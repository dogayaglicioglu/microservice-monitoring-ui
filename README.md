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

# Optional: set your Jaeger URL to make trace IDs in the Log Explorer clickable
# VITE_JAEGER_URL=http://localhost:16686
```

Then in [`src/App.jsx`](src/App.jsx), change:
```js
const USE_MOCK = false
```

Restart the dev server — the dashboard now shows your real service data.

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

## OpenTelemetry / Distributed Tracing

The bundled Go services ship with [OpenTelemetry](https://opentelemetry.io) instrumentation via `otelgin`. Every HTTP request gets a real trace ID that is automatically attached to log entries — so you can correlate a log line in the dashboard back to a full trace in Jaeger.

### Running with Jaeger (full trace UI)

```bash
cd observex-backend
docker compose up
```

This starts all three services plus an **OTel Collector** (`:4317`/`:4318`) and **Jaeger** (UI at [http://localhost:16686](http://localhost:16686)).

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

- [ ] **Native OTLP log ingestion** — instead of polling `/logs`, accept logs pushed via OTLP so services don't need to maintain their own ring buffer. Would need a log storage backend (e.g. Loki) and a query adapter in the aggregator.
- [ ] **Prometheus metrics backend** — replace the `/metrics` poll with a Prometheus query API adapter so the aggregator reads from an existing Prometheus instead of scraping services directly.
- [ ] **Grafana Tempo / Zipkin support** — the Jaeger trace link currently assumes the `/trace/{id}` URL pattern. A `VITE_TRACE_BACKEND=tempo|jaeger|zipkin` flag could adapt the link format per backend.
- [ ] **More than 2 services** — aggregator is currently hardcoded to auth-service + order-service. Make it read a service registry (env var list or config file) so any number of services can be added without code changes.
- [ ] **WebSocket / SSE push** — replace the 15-second poll in `useDashboardData.js` with a server-sent events stream for true real-time updates.
- [ ] **Alerting webhooks** — when a threshold is breached (latency, error rate, uptime), POST to a Slack / PagerDuty / webhook URL instead of only showing the bell icon.

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
