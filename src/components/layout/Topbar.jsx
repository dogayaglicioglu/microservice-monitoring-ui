import { useState, useRef, useEffect } from 'react'
import { Search, RefreshCw, Bell, Clock, AlertTriangle, XCircle, Info, CheckCircle2, Settings } from 'lucide-react'
import { useAlertThresholds } from '../../hooks/useAlertThresholds'
import ThresholdEditor from '../settings/ThresholdEditor'

// -- Alert generation from service metrics --

function computeAlerts(services = [], t = {}) {
  const alerts = []
  const { latencyWarn = 300, latencyCrit = 500, errorWarn = 2, errorCrit = 5, uptime = 99 } = t

  for (const svc of services) {
    if (svc.status === 'down') {
      alerts.push({ id: `${svc.id}-down`, severity: 'critical', service: svc.name, message: `Service is DOWN` })
    } else if (svc.status === 'degraded') {
      alerts.push({ id: `${svc.id}-degraded`, severity: 'warning', service: svc.name, message: `Service is degraded` })
    }

    if (svc.latency > latencyCrit) {
      alerts.push({ id: `${svc.id}-latency-critical`, severity: 'critical', service: svc.name, message: `Latency critical: ${Math.round(svc.latency)}ms (threshold ${latencyCrit}ms)` })
    } else if (svc.latency > latencyWarn) {
      alerts.push({ id: `${svc.id}-latency-warn`, severity: 'warning', service: svc.name, message: `High latency: ${Math.round(svc.latency)}ms (threshold ${latencyWarn}ms)` })
    }

    if (svc.errorRate > errorCrit) {
      alerts.push({ id: `${svc.id}-error-critical`, severity: 'critical', service: svc.name, message: `Error rate critical: ${Number(svc.errorRate).toFixed(2)}% (threshold ${errorCrit}%)` })
    } else if (svc.errorRate > errorWarn) {
      alerts.push({ id: `${svc.id}-error-warn`, severity: 'warning', service: svc.name, message: `High error rate: ${Number(svc.errorRate).toFixed(2)}% (threshold ${errorWarn}%)` })
    }

    if (svc.uptime < uptime) {
      alerts.push({ id: `${svc.id}-uptime`, severity: 'warning', service: svc.name, message: `Low uptime: ${svc.uptime?.toFixed(2)}%` })
    }
  }

  return alerts
}

// -- Alert config --

const severityConfig = {
  critical: {
    icon: XCircle,
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    label: 'Critical',
    row: 'border-red-500/10',
  },
  warning: {
    icon: AlertTriangle,
    dot: 'bg-amber-400',
    badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    label: 'Warning',
    row: 'border-amber-400/10',
  },
  info: {
    icon: Info,
    dot: 'bg-blue-400',
    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    label: 'Info',
    row: 'border-blue-400/10',
  },
}

// -- Topbar --

export default function Topbar({ onSearch, onRefresh, searchValue, lastRefreshed, services = [] }) {
  const [spinning, setSpinning] = useState(false)
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [thresholds, updateThresholds, resetThresholds] = useAlertThresholds()

  const alerts = computeAlerts(services, thresholds)
  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const hasCritical = criticalCount > 0

  function handleRefresh() {
    setSpinning(true)
    onRefresh()
    setTimeout(() => setSpinning(false), 800)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const timeStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—'

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#0f1117] border-b border-[#1f2937] gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search service, traceId…"
          value={searchValue}
          onChange={e => onSearch(e.target.value)}
          className="w-full bg-[#1a1d27] border border-[#2a2d3e] rounded-md pl-9 pr-4 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Last refreshed */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={12} />
          <span>Updated {timeStr}</span>
        </div>

        {/* Bell + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className={`relative w-8 h-8 rounded-md border flex items-center justify-center transition-colors ${
              open
                ? 'bg-[#1f2937] border-gray-600 text-gray-200'
                : 'bg-[#1a1d27] border-[#2a2d3e] text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            <Bell size={14} />
            {alerts.length > 0 && (
              <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${hasCritical ? 'bg-red-500' : 'bg-amber-400'} ${hasCritical ? 'animate-pulse' : ''}`} />
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-10 w-80 rounded-xl border border-[#1f2937] bg-[#111827] shadow-2xl shadow-black/40 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2937]">
                <div className="flex items-center gap-2">
                  <Bell size={13} className="text-gray-400" />
                  <span className="text-xs font-semibold text-white">Alerts</span>
                  {alerts.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${hasCritical ? severityConfig.critical.badge : severityConfig.warning.badge}`}>
                      {alerts.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-600">Live · auto-refresh</span>
              </div>

              {/* Alert list */}
              <div className="max-h-72 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-gray-600">
                    <CheckCircle2 size={22} className="text-emerald-500/40" />
                    <span className="text-xs">All systems operational</span>
                  </div>
                ) : (
                  alerts.map(alert => {
                    const cfg = severityConfig[alert.severity]
                    const Icon = cfg.icon
                    return (
                      <div key={alert.id} className={`flex items-start gap-3 px-4 py-3 border-b ${cfg.row} border-[#1a1d27] last:border-none hover:bg-[#1a1d27] transition-colors`}>
                        <Icon size={13} className={`mt-0.5 shrink-0 ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[11px] font-semibold text-gray-300">{alert.service}</span>
                            <span className={`px-1 py-px rounded text-[9px] font-bold border ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 leading-snug">{alert.message}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-8 h-8 rounded-md border border-[#2a2d3e] bg-[#1a1d27] text-gray-400 hover:text-gray-200 hover:border-gray-600 flex items-center justify-center transition-colors"
        >
          <Settings size={14} />
        </button>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
        >
          <RefreshCw size={13} className={spinning ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {settingsOpen && (
        <ThresholdEditor
          thresholds={thresholds}
          onUpdate={updateThresholds}
          onReset={resetThresholds}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </header>
  )
}
