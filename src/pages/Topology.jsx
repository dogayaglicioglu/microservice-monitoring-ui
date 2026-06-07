import { useMemo } from 'react'
import { useTopology } from '../hooks/useTopology'

const STATUS_COLOR = {
  healthy:  '#34d399',
  degraded: '#fbbf24',
  down:     '#f87171',
}

const W = 720
const H = 420
const R = 160
const CX = W / 2
const CY = H / 2
const NODE_R = 36

function nodePositions(nodes) {
  const n = nodes.length
  return Object.fromEntries(nodes.map((name, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    return [name, { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) }]
  }))
}

function arrowPath(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return ''
  const ux = dx / len
  const uy = dy / len
  const sx = x1 + ux * NODE_R
  const sy = y1 + uy * NODE_R
  const ex = x2 - ux * (NODE_R + 8)
  const ey = y2 - uy * (NODE_R + 8)
  return `M${sx},${sy} L${ex},${ey}`
}

export default function Topology({ services = [] }) {
  const { nodes, edges } = useTopology()

  const statusByName = useMemo(() => {
    const map = {}
    for (const s of services) map[s.name] = s.status
    return map
  }, [services])

  // Fall back to service names when TOPOLOGY env var is not configured
  const displayNodes = nodes.length > 0 ? nodes : services.map(s => s.name)
  const noEdges = nodes.length === 0

  if (displayNodes.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-white">Topology</h1>
          <p className="text-xs text-gray-500 mt-0.5">Service dependency graph</p>
        </div>
        <div className="rounded-xl border border-[#1f2937] bg-[#111827] flex flex-col items-center justify-center py-20">
          <p className="text-sm text-gray-500">No services connected yet</p>
        </div>
      </div>
    )
  }

  const positions = nodePositions(displayNodes)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Topology</h1>
        <p className="text-xs text-gray-500 mt-0.5">Service dependency graph — {displayNodes.length} services{edges.length > 0 ? `, ${edges.length} connections` : ''}</p>
      </div>

      <div className="rounded-xl border border-[#1f2937] bg-[#111827] p-4 flex flex-col items-center gap-3">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#4b5563" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const src = positions[e.source]
            const tgt = positions[e.target]
            if (!src || !tgt) return null
            return (
              <path
                key={i}
                d={arrowPath(src.x, src.y, tgt.x, tgt.y)}
                stroke="#374151"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#arrow)"
              />
            )
          })}

          {/* Nodes */}
          {displayNodes.map(name => {
            const pos = positions[name]
            const status = statusByName[name] || 'unknown'
            const color = STATUS_COLOR[status] ?? '#6b7280'
            return (
              <g key={name} transform={`translate(${pos.x},${pos.y})`}>
                <circle r={NODE_R} fill="#1f2937" stroke={color} strokeWidth="2" />
                <circle r="5" fill={color} cy={-NODE_R + 8} className={status === 'healthy' ? 'animate-pulse' : ''} />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#e5e7eb"
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="600"
                >
                  {name.replace(/-service$/, '')}
                </text>
              </g>
            )
          })}
        </svg>

        {noEdges && (
          <p className="text-xs text-gray-600 pb-1">
            Set <code className="text-gray-500 bg-[#0f1117] px-1 rounded">TOPOLOGY=auth-service→order-service</code> on the aggregator to show dependencies
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {Object.entries(STATUS_COLOR).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs text-gray-500 capitalize">{status}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
          <span className="text-xs text-gray-500">Unknown</span>
        </div>
      </div>
    </div>
  )
}
