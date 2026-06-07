import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

export function useTopology() {
  const [data, setData] = useState({ nodes: [], edges: [] })

  useEffect(() => {
    fetch(`${API_BASE}/api/topology`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  return data
}
