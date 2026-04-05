import Card from '../ui/Card'

export default function StatCard({ label, value, unit, sublabel, color, bg, trend }) {
  const trendIcon = {
    good: (
      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    warn: (
      <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
      </svg>
    ),
    bad: (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {trend && trendIcon[trend]}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>
          {value}
        </span>
        {unit && <span className="text-sm text-slate-400 font-medium">{unit}</span>}
      </div>
      {sublabel && (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ backgroundColor: bg, color }}
          >
            {sublabel}
          </span>
        </div>
      )}
    </Card>
  )
}
