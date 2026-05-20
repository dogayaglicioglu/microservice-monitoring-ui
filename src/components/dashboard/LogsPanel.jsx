import { useState, useMemo } from 'react'
import { Terminal, ChevronDown, Filter, ExternalLink } from 'lucide-react'

const JAEGER_BASE = import.meta.env.VITE_JAEGER_URL ?? ''

const LEVEL_STYLES = {
  INFO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  WARN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ERROR: 'bg-red-500/10 text-red-400 border-red-500/20',
  DEBUG: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const LEVEL_DOT = {
  INFO: 'bg-blue-400',
  WARN: 'bg-amber-400',
  ERROR: 'bg-red-400',
  DEBUG: 'bg-gray-500',
}

function formatTs(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG']
const PAGE_SIZE = 25

export default function LogsPanel({ logs, searchQuery }) {
  const [levelFilter, setLevelFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const matchLevel = levelFilter === 'ALL' || log.level === levelFilter
      const matchSearch = !searchQuery || (
        log.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.traceId.includes(searchQuery) ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
      return matchLevel && matchSearch
    })
  }, [logs, levelFilter, searchQuery])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paginated.length < filtered.length

  return (
    <div className="rounded-xl border border-[#1f2937] bg-[#111827] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937]">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Log Stream</h2>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1a1d27] text-gray-500 border border-[#2a2d3e]">
            {filtered.length} entries
          </span>
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-gray-500" />
          <div className="flex gap-1">
            {LEVELS.map(lvl => (
              <button
                key={lvl}
                onClick={() => { setLevelFilter(lvl); setPage(1) }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  levelFilter === lvl
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1d27]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log rows */}
      <div className="font-mono text-xs">
        {/* Column headers */}
        <div className="grid grid-cols-[120px_140px_56px_148px_1fr] gap-0 px-5 py-2 border-b border-[#1a1d27] bg-[#0f1117]">
          {['Time', 'Service', 'Level', 'Trace ID', 'Message'].map(h => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">{h}</span>
          ))}
        </div>

        {paginated.map((log) => (
          <div
            key={log.id}
            className="grid grid-cols-[120px_140px_56px_148px_1fr] gap-0 px-5 py-2 border-b border-[#1a1d27] hover:bg-[#1a1d27] transition-colors group cursor-default"
          >
            {/* Timestamp */}
            <span className="text-gray-600 tabular-nums">{formatTs(log.timestamp)}</span>

            {/* Service */}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${LEVEL_DOT[log.level]}`} />
              <span className="text-gray-400 truncate">{log.service}</span>
            </div>

            {/* Level */}
            <span className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-bold border w-fit ${LEVEL_STYLES[log.level]}`}>
              {log.level}
            </span>

            {/* Trace ID — clickable if VITE_JAEGER_URL is configured */}
            {JAEGER_BASE ? (
              <a
                href={`${JAEGER_BASE}/trace/${log.traceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-gray-600 tabular-nums truncate hover:text-blue-400 transition-colors group/trace"
                onClick={e => e.stopPropagation()}
              >
                <span className="truncate">{log.traceId}</span>
                <ExternalLink size={10} className="shrink-0 opacity-0 group-hover/trace:opacity-100 transition-opacity" />
              </a>
            ) : (
              <span className="text-gray-600 tabular-nums truncate">{log.traceId}</span>
            )}

            {/* Message */}
            <span className={`truncate ${log.level === 'ERROR' ? 'text-red-300' : log.level === 'WARN' ? 'text-amber-300' : 'text-gray-300'}`}>
              {log.message}
            </span>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-600">
            No logs match the current filters.
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="border-t border-[#1f2937] p-3 flex justify-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronDown size={14} />
            Load more ({filtered.length - paginated.length} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
