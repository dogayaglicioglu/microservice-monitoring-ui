// Drop this file into your Node.js/Express service, call observex.register(app, cfg) once.
// It exposes /health, /metrics, and /logs — the three endpoints ObserveX needs.
'use strict'

const SKIP = new Set(['/health', '/metrics', '/logs'])
const MAX_LATENCIES = 100
const MAX_LOGS = 200

let cfg = {}
const startTime = Date.now()

let totalReqs = 0
let errorReqs = 0
const latencies = []

let rpsCounter = 0
let currentRPS = 0
setInterval(() => {
  currentRPS = rpsCounter
  rpsCounter = 0
}, 1000)

let logSeq = 0
const logs = []

/**
 * Wire up ObserveX into your Express app.
 *
 * @param {import('express').Application} app
 * @param {{ name: string, version: string, region: string }} config
 *
 * @example
 * const observex = require('./observex')
 * observex.register(app, { name: 'order-service', version: 'v1.0.0', region: 'us-east-1' })
 */
function register(app, config) {
  cfg = config

  app.use(instrument)

  app.get('/health', handleHealth)
  app.get('/metrics', handleMetrics)
  app.get('/logs', handleLogs)
}

/**
 * Append a log entry to the ring buffer so it appears in the ObserveX Log Explorer.
 * Call this from your existing logger.
 *
 * @param {'INFO'|'WARN'|'ERROR'|'DEBUG'} level
 * @param {string} message
 * @param {string} [traceId]
 */
function appendLog(level, message, traceId = '') {
  const entry = {
    id: `${cfg.name}-${++logSeq}`,
    timestamp: new Date().toISOString(),
    service: cfg.name,
    level,
    traceId,
    message,
  }
  logs.unshift(entry)
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
}

// -- internals --

function instrument(req, res, next) {
  if (SKIP.has(req.path)) return next()

  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    totalReqs++
    rpsCounter++
    if (res.statusCode >= 400) errorReqs++
    latencies.push(ms)
    if (latencies.length > MAX_LATENCIES) latencies.shift()
  })
  next()
}

function handleHealth(_req, res) {
  res.json({
    service: cfg.name,
    status: 'healthy',
    version: cfg.version,
    region: cfg.region,
    uptime: calcUptime(),
  })
}

function handleMetrics(_req, res) {
  res.json({
    rps: currentRPS,
    latency: avgLatency(),
    errorRate: errorRate(),
    totalReqs,
  })
}

function handleLogs(_req, res) {
  res.json(logs)
}

function avgLatency() {
  if (latencies.length === 0) return 0
  return latencies.reduce((a, b) => a + b, 0) / latencies.length
}

function errorRate() {
  if (totalReqs === 0) return 0
  return (errorReqs / totalReqs) * 100
}

function calcUptime() {
  const er = errorRate()
  return Math.max(0, 100 - er * 0.1)
}

module.exports = { register, appendLog }
