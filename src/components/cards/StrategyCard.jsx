import Card from '../ui/Card'
import Badge from '../ui/Badge'
import { getEvidenceLabel, getEfforLabel, getCategoryColor } from '../../utils/formatters'

function EffectivenessBar({ value }) {
  const color = value >= 85 ? '#22C55E' : value >= 70 ? '#3B82F6' : '#F59E0B'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{value}%</span>
    </div>
  )
}

export default function StrategyCard({ strategy }) {
  const { name, category, categoryLabel, effectiveness, timeToEffect, effort, evidence, description, howTo } = strategy
  const catColor = getCategoryColor(category)
  const evidenceInfo = getEvidenceLabel(evidence)

  return (
    <Card hover className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: catColor.bg, color: catColor.text }}
            >
              {categoryLabel}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ color: evidenceInfo.color, backgroundColor: `${evidenceInfo.color}15` }}
            >
              {evidenceInfo.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
        </div>
      </div>

      {/* Effectiveness */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-slate-500 font-medium">Effectiveness</span>
          <span className="text-xs text-slate-500">{getEfforLabel(effort)} effort</span>
        </div>
        <EffectivenessBar value={effectiveness} />
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 leading-relaxed">{description}</p>

      {/* How To */}
      {howTo && howTo.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">How to apply</p>
          <ul className="space-y-1.5">
            {howTo.slice(0, 3).map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
        <span className="text-[11px] text-slate-400">Effect in {timeToEffect}</span>
      </div>
    </Card>
  )
}
