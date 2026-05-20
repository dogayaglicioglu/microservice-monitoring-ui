import { useState } from 'react'
import { Search, RefreshCw, Bell, Clock } from 'lucide-react'

export default function Topbar({ onSearch, onRefresh, searchValue, lastRefreshed }) {
  const [spinning, setSpinning] = useState(false)

  function handleRefresh() {
    setSpinning(true)
    onRefresh()
    setTimeout(() => setSpinning(false), 800)
  }

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

        {/* Notification */}
        <button className="relative w-8 h-8 rounded-md bg-[#1a1d27] border border-[#2a2d3e] flex items-center justify-center text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors">
          <Bell size={14} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
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
    </header>
  )
}
