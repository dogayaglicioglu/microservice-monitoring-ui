import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

async function fetchJSON(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${path} returned ${res.status}`)
  return res.json()
}

export function useSSEData(points = 90) {
  const [kpis, setKpis]             = useState(null)
  const [services, setServices]     = useState([])
  const [chartData, setChartData]   = useState([])
  const [latencyData, setLatency]   = useState([])
  const [logs, setLogs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const esRef = useRef(null)

  // Initial full fetch (SSE only streams metrics/kpis, not services or logs)
  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [k, s, rps, lat, l] = await Promise.all([
        fetchJSON('/api/kpis'),
        fetchJSON('/api/services'),
        fetchJSON(`/api/metrics/rps?points=${points}`),
        fetchJSON(`/api/metrics/latency?points=${points}`),
        fetchJSON('/api/logs?limit=200'),
      ])
      setKpis(k)
      setServices(s)
      setChartData(rps)
      setLatency(lat)
      setLogs(l)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [points])

  // SSE connection for chart data updates
  useEffect(() => {
    fetchAll()

    const es = new EventSource(`${API_BASE}/api/stream`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload.rps)     setChartData(payload.rps.slice(-points))
        if (payload.latency) setLatency(payload.latency.slice(-points))
        if (payload.kpis)    setKpis(prev => prev ? { ...prev, ...payload.kpis } : payload.kpis)
      } catch {}
    }

    es.onerror = () => {
      setError(null) // SSE errors are transient, don't show error screen
    }

    return () => es.close()
  }, [fetchAll, points])

  // Services + logs on slower poll (30s) since they're not in SSE stream
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [s, l] = await Promise.all([
          fetchJSON('/api/services'),
          fetchJSON('/api/logs?limit=200'),
        ])
        setServices(s)
        setLogs(l)
      } catch {}
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const refetch = useCallback(() => {
    fetchAll()
  }, [fetchAll])

  return { kpis, services, chartData, latencyData: latencyData, logs, loading, error, refetch }
}
