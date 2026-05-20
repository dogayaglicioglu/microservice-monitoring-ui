import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const SERVICES = [
  { key: 'auth-service',    color: '#60a5fa' },
  { key: 'order-service',   color: '#a78bfa' },
  { key: 'payment-service', color: '#34d399' },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-lg px-3 py-2.5 shadow-xl text-xs">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-semibold tabular-nums">{p.value} req/s</span>
        </div>
      ))}
    </div>
  )
}

export default function RequestChart({ data }) {
  const [hidden, setHidden] = useState({})

  function toggle(key) {
    setHidden(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const visibleServices = SERVICES.filter(s => data.some(d => d[s.key] !== undefined))

  return (
    <div className="rounded-xl border border-[#1f2937] bg-[#111827] p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Requests / Second</h2>
        <p className="text-xs text-gray-500 mt-0.5">Live traffic per service — last 30 data points</p>
      </div>

      {/* Clickable legend */}
      <div className="flex items-center gap-3 mb-4">
        {visibleServices.map(({ key, color }) => {
          const isHidden = !!hidden[key]
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                isHidden
                  ? 'border-[#2a2d3e] text-gray-600 bg-transparent'
                  : 'border-[#2a2d3e] text-gray-300 bg-[#1a1d27]'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full transition-opacity"
                style={{ background: color, opacity: isHidden ? 0.2 : 1 }}
              />
              <span className={isHidden ? 'line-through opacity-40' : ''}>{key}</span>
            </button>
          )
        })}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {visibleServices.map(({ key, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={false}
              hide={!!hidden[key]}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
