import { CheckCircle2, AlertTriangle, Cpu, Globe, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'

const statusConfig = {
  healthy: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', dot: 'bg-emerald-400' },
  degraded: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', dot: 'bg-amber-400' },
}

function Metric({ label, value, unit, trend }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-600 uppercase tracking-wide font-semibold">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-white tabular-nums">{value}</span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
      {trend && (
        <div className={`flex items-center gap-0.5 text-[10px] ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  )
}

export default function Services({ services, searchQuery }) {
  const filtered = services.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Services</h1>
          <p className="text-xs text-gray-500 mt-0.5">Detailed view of all monitored microservices</p>
        </div>
        <span className="text-xs text-gray-600">{filtered.length} services</span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.map(svc => {
          const cfg = statusConfig[svc.status] || statusConfig.healthy
          return (
            <div key={svc.id} className="rounded-xl border border-[#1f2937] bg-[#111827] p-5 hover:border-[#374151] transition-colors">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${cfg.bg} ${cfg.border} border flex items-center justify-center`}>
                    <div className={`w-3 h-3 rounded-full ${cfg.dot} ${svc.status === 'healthy' ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{svc.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Globe size={10} />
                        <span>{svc.region}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Cpu size={10} />
                        <span>{svc.instances} instances</span>
                      </div>
                      <span className="text-[11px] text-gray-600">{svc.version}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                  {svc.status.charAt(0).toUpperCase() + svc.status.slice(1)}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-4 pt-4 border-t border-[#1f2937]">
                <Metric label="Latency" value={Math.round(svc.latency)} unit="ms" />
                <Metric label="Error Rate" value={Number(svc.errorRate).toFixed(2)} unit="%" />
                <Metric label="Req/s" value={Math.round(svc.rps)} />
                <Metric label="Uptime" value={`${svc.uptime.toFixed(2)}`} unit="%" />
                <Metric label="Instances" value={svc.instances} />
              </div>

              {/* Uptime bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                  <span>Uptime (30d)</span>
                  <span>{svc.uptime.toFixed(3)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1f2937] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${svc.uptime >= 99.5 ? 'bg-emerald-400' : svc.uptime >= 98 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${svc.uptime}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
