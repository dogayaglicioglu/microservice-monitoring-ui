import { useState, useEffect, useCallback } from 'react'

// Swap this base URL for your real aggregator API
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

async function fetchJSON(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${path} returned ${res.status}`)
  return res.json()
}

export function useDashboardData() {
  const [kpis, setKpis] = useState(null)
  const [services, setServices] = useState([])
  const [chartData, setChartData] = useState([])
  const [latencyData, setLatencyData] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [k, s, rps, lat, l] = await Promise.all([
        fetchJSON('/api/kpis'),
        fetchJSON('/api/services'),
        fetchJSON('/api/metrics/rps?window=30m'),
        fetchJSON('/api/metrics/latency?window=30m'),
        fetchJSON('/api/logs?limit=200'),
      ])
      setKpis(k)
      setServices(s)
      setChartData(rps)
      setLatencyData(lat)
      setLogs(l)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => { fetchAll() }, [fetchAll])

  // Poll every 15 seconds for live data
  useEffect(() => {
    const id = setInterval(fetchAll, 15_000)
    return () => clearInterval(id)
  }, [fetchAll])

  return { kpis, services, chartData, latencyData, logs, loading, error, refetch: fetchAll }
}
