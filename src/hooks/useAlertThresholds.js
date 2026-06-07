import { useState, useCallback } from 'react'

export const THRESHOLD_DEFAULTS = {
  latencyWarn: 300,
  latencyCrit: 500,
  errorWarn:   2,
  errorCrit:   5,
  uptime:      99,
}

const LS_KEY = 'observex:thresholds'

export function useAlertThresholds() {
  const [thresholds, setThresholds] = useState(() => {
    try {
      return { ...THRESHOLD_DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY)) }
    } catch {
      return THRESHOLD_DEFAULTS
    }
  })

  const update = useCallback(patch => {
    setThresholds(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    setThresholds(THRESHOLD_DEFAULTS)
  }, [])

  return [thresholds, update, reset]
}
