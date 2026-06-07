import { useState } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { THRESHOLD_DEFAULTS } from '../../hooks/useAlertThresholds'

function Field({ label, hint, name, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-1">
        {label}
        {hint && <span className="text-gray-600 font-normal ml-1">({hint})</span>}
      </label>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={e => onChange(name, Number(e.target.value))}
        className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all tabular-nums"
      />
    </div>
  )
}

export default function ThresholdEditor({ thresholds, onUpdate, onReset, onClose }) {
  const [draft, setDraft] = useState(thresholds)

  function handleChange(name, value) {
    setDraft(prev => ({ ...prev, [name]: value }))
  }

  function handleSave() {
    onUpdate(draft)
    onClose()
  }

  function handleReset() {
    setDraft(THRESHOLD_DEFAULTS)
    onReset()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-96 rounded-xl border border-[#1f2937] bg-[#111827] shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937]">
          <div>
            <h2 className="text-sm font-semibold text-white">Alert Thresholds</h2>
            <p className="text-xs text-gray-500 mt-0.5">Saved to this browser</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Latency</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Warning" hint="ms" name="latencyWarn" value={draft.latencyWarn} onChange={handleChange} />
              <Field label="Critical" hint="ms" name="latencyCrit" value={draft.latencyCrit} onChange={handleChange} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Error Rate</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Warning" hint="%" name="errorWarn" value={draft.errorWarn} onChange={handleChange} />
              <Field label="Critical" hint="%" name="errorCrit" value={draft.errorCrit} onChange={handleChange} />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Uptime</p>
            <Field label="Warning below" hint="%" name="uptime" value={draft.uptime} onChange={handleChange} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#1f2937]">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RotateCcw size={12} />
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-200 border border-[#2a2d3e] hover:border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
