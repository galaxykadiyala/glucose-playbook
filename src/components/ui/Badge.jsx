export default function Badge({ children, variant = 'default', size = 'sm', className = '' }) {
  const variants = {
    default:   'bg-slate-100 text-slate-700',
    blue:      'bg-blue-50 text-blue-700 border border-blue-200',
    green:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
    amber:     'bg-amber-50 text-amber-700 border border-amber-200',
    red:       'bg-red-50 text-red-700 border border-red-200',
    purple:    'bg-purple-50 text-purple-700 border border-purple-200',
    cyan:      'bg-cyan-50 text-cyan-700 border border-cyan-200',
    excellent: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    good:      'bg-blue-50 text-blue-700 border border-blue-200',
    moderate:  'bg-amber-50 text-amber-700 border border-amber-200',
    avoid:     'bg-red-50 text-red-700 border border-red-200',
  }

  const sizes = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  }

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant] || variants.default} ${sizes[size]} ${className}`}>
      {children}
    </span>
  )
}
