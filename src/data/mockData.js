const now = Date.now()

function generateTimeSeries(points, baseValue, variance, upward = false) {
  return Array.from({ length: points }, (_, i) => {
    const drift = upward ? i * (variance * 0.05) : 0
    const noise = (Math.random() - 0.5) * variance
    return Math.max(0, Math.round(baseValue + drift + noise))
  })
}

function timeLabels(points, intervalMinutes = 2) {
  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - 1 - i) * intervalMinutes * 60 * 1000)
    return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  })
}

const labels = timeLabels(30)
const rpsAuth = generateTimeSeries(30, 320, 80)
const rpsOrder = generateTimeSeries(30, 180, 60)
const rpsPayment = generateTimeSeries(30, 95, 40)

const latAuth = generateTimeSeries(30, 42, 18)
const latOrder = generateTimeSeries(30, 78, 25)
const latPayment = generateTimeSeries(30, 130, 35)

export const chartData = labels.map((time, i) => ({
  time,
  'auth-service': rpsAuth[i],
  'order-service': rpsOrder[i],
  'payment-service': rpsPayment[i],
}))

export const latencyData = labels.map((time, i) => ({
  time,
  'auth-service': latAuth[i],
  'order-service': latOrder[i],
  'payment-service': latPayment[i],
}))

export const services = [
  {
    id: 'auth-service',
    name: 'auth-service',
    status: 'healthy',
    latency: 42,
    uptime: 99.98,
    rps: rpsAuth[rpsAuth.length - 1],
    errorRate: 0.12,
    instances: 3,
    version: 'v2.4.1',
    region: 'us-east-1',
  },
  {
    id: 'order-service',
    name: 'order-service',
    status: 'degraded',
    latency: 312,
    uptime: 98.71,
    rps: rpsOrder[rpsOrder.length - 1],
    errorRate: 3.47,
    instances: 2,
    version: 'v1.9.3',
    region: 'us-west-2',
  },
  {
    id: 'payment-service',
    name: 'payment-service',
    status: 'healthy',
    latency: 95,
    uptime: 99.91,
    rps: rpsPayment[rpsPayment.length - 1],
    errorRate: 0.58,
    instances: 4,
    version: 'v3.1.0',
    region: 'eu-west-1',
  },
]

const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG']
const SERVICE_NAMES = ['auth-service', 'order-service', 'payment-service']

const LOG_MESSAGES = {
  INFO: [
    'Request processed successfully',
    'Cache hit for user session',
    'Health check passed',
    'Connection pool initialized',
    'Token validated for user',
    'Database query executed in 12ms',
    'Outbound webhook dispatched',
  ],
  WARN: [
    'Response time exceeded 200ms threshold',
    'Retry attempt 2/3 for upstream call',
    'Memory usage above 75%',
    'Rate limit approaching for client',
    'Slow query detected: 450ms',
    'Circuit breaker in half-open state',
  ],
  ERROR: [
    'Failed to connect to database: timeout',
    'Unhandled exception in payment handler',
    'JWT signature verification failed',
    'Upstream service returned 503',
    'Transaction rollback due to constraint violation',
    'Max retries exceeded for order dispatch',
  ],
  DEBUG: [
    'Entering middleware chain',
    'Span created: 7a3f91bc',
    'Cache miss — fetching from origin',
    'Decoded JWT payload',
    'SQL: SELECT * FROM orders WHERE id = $1',
  ],
}

function randomTraceId() {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

function generateLogs(count) {
  return Array.from({ length: count }, (_, i) => {
    const level = LOG_LEVELS[Math.floor(Math.random() * (i % 8 === 0 ? 3 : LOG_LEVELS.length))]
    const service = SERVICE_NAMES[Math.floor(Math.random() * SERVICE_NAMES.length)]
    const messages = LOG_MESSAGES[level]
    const message = messages[Math.floor(Math.random() * messages.length)]
    const ts = new Date(now - i * (Math.random() * 4000 + 500))
    return {
      id: `log-${i}`,
      timestamp: ts.toISOString(),
      service,
      level,
      traceId: randomTraceId(),
      message,
    }
  })
}

export const logs = generateLogs(200)

export const kpis = {
  totalRequests: 2847392,
  errorRate: 1.38,
  avgLatency: 84,
  activeServices: 3,
}
