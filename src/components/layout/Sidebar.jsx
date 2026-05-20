import { LayoutDashboard, Server, ScrollText, Activity, ChevronRight } from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'services', label: 'Services', icon: Server },
  { id: 'logs', label: 'Logs', icon: ScrollText },
]

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#0f1117] border-r border-[#1f2937] min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#1f2937]">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
          <Activity size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-white tracking-wide">ObserveX</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
          Navigation
        </p>
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = activePage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-[#1e3a5f] text-blue-400'
                  : 'text-gray-400 hover:bg-[#1a1d27] hover:text-gray-200'
              }`}
            >
              <Icon size={15} className={active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'} />
              <span>{label}</span>
              {active && <ChevronRight size={13} className="ml-auto text-blue-400/60" />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#1f2937]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-500">All systems operational</span>
        </div>
      </div>
    </aside>
  )
}
