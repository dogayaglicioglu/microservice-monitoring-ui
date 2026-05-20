import { CheckCircle2, AlertTriangle, XCircle, ChevronRight, Cpu, Globe } from 'lucide-react'

const statusConfig = {
  healthy: {
    icon: CheckCircle2,
    label: 'Healthy',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    dot: 'bg-amber-400',
    badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  },
  down: {
    icon: XCircle,
    label: 'Down',
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
}

function latencyColor(ms) {
  if (ms < 100) return 'text-emerald-400'
  if (ms < 300) return 'text-amber-400'
  return 'text-red-400'
}

function uptimeColor(pct) {
  if (pct >= 99.5) return 'text-emerald-400'
  if (pct >= 98) return 'text-amber-400'
  return 'text-red-400'
}

function UptimeBar({ value }) {
  const color = value >= 99.5 ? 'bg-emerald-400' : value >= 98 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#1f2937] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-sm tabular-nums ${uptimeColor(value)}`}>{value.toFixed(2)}%</span>
    </div>
  )
}

export default function ServiceTable({ services, searchQuery }) {
  const filtered = services.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="rounded-xl border border-[#1f2937] bg-[#111827] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937]">
        <div>
          <h2 className="text-sm font-semibold text-white">Service Health</h2>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.length} services monitored</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1f2937]">
              {['Service', 'Status', 'Latency', 'Error Rate', 'RPS', 'Uptime', 'Instances', ''].map(col => (
                <th key={col} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((svc, i) => {
              const cfg = statusConfig[svc.status] || statusConfig.healthy
              return (
                <tr
                  key={svc.id}
                  className={`group border-b border-[#1a1d27] hover:bg-[#1a1d27] transition-colors cursor-pointer ${
                    i === filtered.length - 1 ? 'border-none' : ''
                  }`}
                >
                  {/* Service name */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot} ${svc.status === 'healthy' ? 'animate-pulse' : ''}`} />
                      <div>
                        <p className="font-medium text-gray-100">{svc.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Globe size={10} className="text-gray-600" />
                          <span className="text-[10px] text-gray-600">{svc.region}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </td>

                  {/* Latency */}
                  <td className="px-5 py-3.5">
                    <span className={`tabular-nums font-mono font-medium ${latencyColor(svc.latency)}`}>
                      {svc.latency} <span className="text-gray-600 font-normal text-xs">ms</span>
                    </span>
                  </td>

                  {/* Error Rate */}
                  <td className="px-5 py-3.5">
                    <span className={`tabular-nums font-medium ${svc.errorRate > 2 ? 'text-red-400' : svc.errorRate > 0.5 ? 'text-amber-400' : 'text-gray-400'}`}>
                      {svc.errorRate.toFixed(2)}%
                    </span>
                  </td>

                  {/* RPS */}
                  <td className="px-5 py-3.5">
                    <span className="tabular-nums text-gray-300">{svc.rps} <span className="text-gray-600 text-xs">req/s</span></span>
                  </td>

                  {/* Uptime */}
                  <td className="px-5 py-3.5">
                    <UptimeBar value={svc.uptime} />
                  </td>

                  {/* Instances */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <Cpu size={12} className="text-gray-600" />
                      <span className="text-gray-400">{svc.instances}</span>
                    </div>
                  </td>

                  {/* Arrow */}
                  <td className="px-5 py-3.5">
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
