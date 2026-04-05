import Card from '../ui/Card'

const typeConfig = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-600',   dot: 'bg-amber-500'   },
  danger:  { bg: 'bg-red-50',     border: 'border-red-200',     icon: 'text-red-600',     dot: 'bg-red-500'     },
  info:    { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-600',    dot: 'bg-blue-500'    },
}

const icons = {
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  danger: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export default function InsightCard({ title, body, type = 'info' }) {
  const cfg = typeConfig[type] || typeConfig.info

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex-shrink-0 ${cfg.icon}`}>{icons[type]}</span>
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  )
}
