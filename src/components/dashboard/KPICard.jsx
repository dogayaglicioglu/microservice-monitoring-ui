import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const trendColors = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  neutral: 'text-gray-500',
}

export default function KPICard({ title, value, unit, trend, trendValue, icon: Icon, accent }) {
  const trendDir = trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'neutral'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const accentMap = {
    blue: 'from-blue-500/10 to-transparent border-blue-500/20',
    violet: 'from-violet-500/10 to-transparent border-violet-500/20',
    amber: 'from-amber-500/10 to-transparent border-amber-500/20',
    emerald: 'from-emerald-500/10 to-transparent border-emerald-500/20',
  }

  const iconAccent = {
    blue: 'bg-blue-500/10 text-blue-400',
    violet: 'bg-violet-500/10 text-violet-400',
    amber: 'bg-amber-500/10 text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
  }

  return (
    <div className={`relative rounded-xl border bg-gradient-to-br p-5 overflow-hidden ${accentMap[accent] || accentMap.blue} bg-[#111827]`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconAccent[accent] || iconAccent.blue}`}>
          <Icon size={17} />
        </div>
        {trendValue !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColors[trendDir]}`}>
            <TrendIcon size={12} />
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
          {unit && <span className="text-sm text-gray-400 font-medium">{unit}</span>}
        </div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
      </div>

      {/* Decorative glow */}
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 ${
        accent === 'blue' ? 'bg-blue-500' :
        accent === 'violet' ? 'bg-violet-500' :
        accent === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
      }`} />
    </div>
  )
}
