# ObserveX integration examples

Each file is a self-contained drop-in that adds the three endpoints ObserveX needs
(`/health`, `/metrics`, `/logs`) plus request instrumentation to an existing service.

Copy the file for your stack, call `register` once, done.

---

## Go / gin

```go
import "yourmodule/observex"

func main() {
    r := gin.Default()

    observex.Register(r, observex.Config{
        Name:    "auth-service",
        Version: "v1.2.3",
        Region:  "us-east-1",
    })

    // your routes here
    r.GET("/users", handleUsers)

    r.Run(":3001")
}
```

To send a log entry from anywhere in your code:

```go
observex.AppendLog("ERROR", "DB connection failed", traceID)
```

→ [`go-gin/observex.go`](go-gin/observex.go)

---

## Node.js / Express

```js
const express = require('express')
const observex = require('./observex')

const app = express()

observex.register(app, {
    name: 'order-service',
    version: 'v1.0.0',
    region: 'us-west-2',
})

// your routes here
app.get('/orders', handleOrders)

app.listen(3002)
```

To send a log entry:

```js
observex.appendLog('WARN', 'Slow query detected', traceId)
```

→ [`node-express/observex.js`](node-express/observex.js)

---

## Python / FastAPI

```python
import uvicorn
from fastapi import FastAPI
import observex

app = FastAPI()

observex.register(app, observex.Config(
    name="payment-service",
    version="v2.1.0",
    region="eu-west-1",
))

# your routes here
@app.get("/payments")
async def list_payments():
    ...

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3003)
```

To send a log entry:

```python
observex.append_log("INFO", "Payment processed", trace_id=span_id)
```

→ [`python-fastapi/observex.py`](python-fastapi/observex.py)

---

## What each file instruments automatically

| | RPS | Avg latency | Error rate | Total requests |
|---|---|---|---|---|
| go-gin | ✓ | ✓ | ✓ | ✓ |
| node-express | ✓ | ✓ | ✓ | ✓ |
| python-fastapi | ✓ | ✓ | ✓ | ✓ |

Uptime is approximated as `100 - errorRate * 0.1`. Replace `calcUptime` / `_calc_uptime`
with your own SLO tracking if you need something more precise.
