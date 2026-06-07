import { Activity, AlertCircle, Timer, Server } from 'lucide-react'
import KPICard from '../components/dashboard/KPICard'
import ServiceTable from '../components/dashboard/ServiceTable'
import RequestChart from '../components/dashboard/RequestChart'
import LatencyChart from '../components/dashboard/LatencyChart'
import LogsPanel from '../components/dashboard/LogsPanel'
import TimeRangeSelector from '../components/dashboard/TimeRangeSelector'

export default function Dashboard({ kpis, services, chartData, latencyData, logs, searchQuery, timeRange, onTimeRangeChange }) {
  const kpiCards = [
    {
      title: 'Total Requests',
      value: (kpis.totalRequests / 1_000_000).toFixed(2),
      unit: 'M',
      trend: 'up',
      trendValue: '+4.2%',
      icon: Activity,
      accent: 'blue',
    },
    {
      title: 'Error Rate',
      value: kpis.errorRate.toFixed(2),
      unit: '%',
      trend: kpis.errorRate > 2 ? 'up' : 'down',
      trendValue: kpis.errorRate > 2 ? '+0.8%' : '-0.3%',
      icon: AlertCircle,
      accent: kpis.errorRate > 2 ? 'amber' : 'emerald',
    },
    {
      title: 'Avg Latency',
      value: kpis.avgLatency,
      unit: 'ms',
      trend: 'neutral',
      trendValue: '±2ms',
      icon: Timer,
      accent: 'violet',
    },
    {
      title: 'Active Services',
      value: kpis.activeServices,
      unit: `/ ${services.length}`,
      trend: 'neutral',
      icon: Server,
      accent: 'emerald',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <KPICard key={card.title} {...card} />
        ))}
      </div>

      {/* Service Table */}
      <ServiceTable services={services} searchQuery={searchQuery} />

      {/* Charts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Showing last <span className="text-gray-300 font-medium">{timeRange}</span></p>
          <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <RequestChart data={chartData} />
          <LatencyChart data={latencyData} />
        </div>
      </div>

      {/* Logs */}
      <LogsPanel logs={logs} searchQuery={searchQuery} />
    </div>
  )
}
