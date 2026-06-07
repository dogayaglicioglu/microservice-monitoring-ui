const RANGES = [
  { label: '15m', points: 90  },
  { label: '30m', points: 180 },
  { label: '1h',  points: 360 },
]

export default function TimeRangeSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-[#0f1117] border border-[#1f2937] rounded-lg p-0.5">
      {RANGES.map(r => (
        <button
          key={r.label}
          onClick={() => onChange(r.label, r.points)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === r.label
              ? 'bg-[#1f2937] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
