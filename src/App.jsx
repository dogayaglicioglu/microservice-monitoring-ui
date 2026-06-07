import { useState, useCallback } from 'react'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Dashboard from './pages/Dashboard'
import Services from './pages/Services'
import Logs from './pages/Logs'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// Mock data (used while USE_MOCK = true)
import {
  kpis as mockKpis,
  services as mockServices,
  chartData as mockChart,
  latencyData as mockLatency,
  logs as mockLogs,
} from './data/mockData'

// Real data hook (used when USE_MOCK = false)
import { useDashboardData } from './hooks/useDashboardData'

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0b0d14]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Connecting to services…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0b0d14]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <span className="text-red-400 text-lg">!</span>
        </div>
        <div>
          <p className="text-sm font-medium text-white">Failed to load dashboard</p>
          <p className="text-xs text-gray-500 mt-1">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

function AppShell({ data }) {
  const [activePage, setActivePage] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  const handleRefresh = useCallback(() => {
    data.refetch?.()
    setLastRefreshed(new Date())
  }, [data])

  const pageProps = {
    kpis: data.kpis,
    services: data.services,
    chartData: data.chartData,
    latencyData: data.latencyData,
    logs: data.logs,
    searchQuery,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0d14]">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar
          onSearch={setSearchQuery}
          onRefresh={handleRefresh}
          searchValue={searchQuery}
          lastRefreshed={lastRefreshed}
          services={data.services}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {activePage === 'dashboard' && <Dashboard {...pageProps} />}
          {activePage === 'services' && <Services services={data.services} searchQuery={searchQuery} />}
          {activePage === 'logs'     && <Logs logs={data.logs} searchQuery={searchQuery} />}
        </main>
      </div>
    </div>
  )
}

// Thin wrapper: swaps mock vs real data source
function MockDataProvider({ children }) {
  const data = {
    kpis: mockKpis,
    services: mockServices,
    chartData: mockChart,
    latencyData: mockLatency,
    logs: mockLogs,
    loading: false,
    error: null,
    refetch: () => {},
  }
  return children(data)
}

function RealDataProvider({ children }) {
  const data = useDashboardData()
  if (data.loading) return <LoadingScreen />
  if (data.error)   return <ErrorScreen message={data.error} onRetry={data.refetch} />
  return children(data)
}

export default function App() {
  const Provider = USE_MOCK ? MockDataProvider : RealDataProvider
  return (
    <Provider>
      {data => <AppShell data={data} />}
    </Provider>
  )
}
