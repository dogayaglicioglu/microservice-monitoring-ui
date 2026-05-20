import LogsPanel from '../components/dashboard/LogsPanel'

export default function Logs({ logs, searchQuery }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Log Explorer</h1>
        <p className="text-xs text-gray-500 mt-0.5">Full log stream across all services — filter by level or search</p>
      </div>
      <LogsPanel logs={logs} searchQuery={searchQuery} />
    </div>
  )
}
