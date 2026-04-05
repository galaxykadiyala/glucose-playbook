import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts'
import cgmData from '../data/cgmData.json'
import {
  analyseDataset,
  deltaColor,
  severityMeta,
  giLabel,
} from '../utils/insightsEngine'
import { getZone, ZONE_COLORS } from '../utils/glucoseZones'

// ─── Derived data ─────────────────────────────────────────────────────────────

function useInsights() {
  return useMemo(() => analyseDataset(cgmData.meals), [])
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, sub, color, bg, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>{value}</span>
        {unit && <span className="text-sm text-slate-400 font-medium">{unit}</span>}
      </div>
      {sub && (
        <span
          className="self-start inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium"
          style={{ backgroundColor: bg, color }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}

// ─── Timeline chart ────────────────────────────────────────────────────────────

function ZoneDot(props) {
  const { cx, cy, value, payload } = props
  if (cx == null || cy == null || value == null) return null
  const zone  = getZone(value)
  const color = zone ? ZONE_COLORS[zone].stroke : '#94A3B8'
  return (
    <g>
      {/* Outer ring for spike events */}
      {payload.spike && (
        <circle cx={cx} cy={cy} r={9} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.35} />
      )}
      <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="white" strokeWidth={2} />
    </g>
  )
}

function TimelineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d   = payload[0].payload
  const sev = severityMeta(d.severity)
  const zone = getZone(d.peak)
  const zc   = zone ? ZONE_COLORS[zone] : null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">{d.label}</p>
      <p className="text-slate-500 mb-2">{d.date} · {d.time}</p>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-500">Peak</span>
        <span className="font-bold" style={{ color: zc?.stroke ?? '#1e293b' }}>{d.peak} mg/dL</span>
      </div>
      {zc && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-500">Zone</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: zc.bg, color: zc.stroke }}>{zc.label}</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-500">Baseline</span>
        <span className="font-medium text-slate-700 dark:text-slate-300">{d.baseline} mg/dL</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500">Delta</span>
        <span className="font-bold" style={{ color: deltaColor(d.delta) }}>+{d.delta}</span>
      </div>
      {d.spike && (
        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: sev.bg, color: sev.color }}>
          {sev.label} Spike
        </span>
      )}
    </div>
  )
}

function GlucoseTimeline({ meals, insights }) {
  const [view, setView] = useState('peak')

  const chartData = useMemo(() => meals.map((m, i) => {
    const mealInsight = insights.meal_insights[i]
    return {
      index:    i + 1,
      id:       m.id,
      date:     m.date?.slice(5),
      time:     m.datetime?.slice(11, 16),
      label:    m.foods.map(f => f.name).join(', ').slice(0, 30),
      peak:     m.glucose.peak,
      baseline: m.glucose.baseline,
      delta:    m.glucose.delta,
      spike:    m.spike,
      severity: mealInsight.spike_severity,
    }
  }), [meals, insights])

  const dataKey = view === 'peak' ? 'peak' : 'delta'
  const yDomain = view === 'peak' ? [70, 200] : [0, 90]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Glucose Timeline</h2>
          <p className="text-xs text-slate-400 mt-0.5">All 20 meals · red dots = spikes</p>
        </div>
        <div className="flex gap-1">
          {[
            { key: 'peak',  label: 'Peak' },
            { key: 'delta', label: 'Delta' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                view === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          {/* Zones */}
          {view === 'peak' && (
            <>
              <ReferenceArea y1={70}  y2={140} fill="#F0FDF4" fillOpacity={0.5} />
              <ReferenceArea y1={140} y2={200} fill="#FEF2F2" fillOpacity={0.4} />
            </>
          )}
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `M${v}`}
            interval={1}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => view === 'peak' ? v : `+${v}`}
          />
          <Tooltip content={<TimelineTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }} />
          {view === 'peak' && (
            <ReferenceLine y={140} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} />
          )}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#CBD5E1"
            strokeWidth={1.5}
            dot={view === 'peak' ? <ZoneDot /> : false}
            activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50 flex-wrap">
        {view === 'peak' ? (
          <>
            {Object.entries(ZONE_COLORS).map(([key, zc]) => (
              <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: zc.stroke }} />
                {zc.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 ml-1">
              <span className="w-3.5 h-3.5 rounded-full border border-slate-400 flex-shrink-0" />
              Spike event
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="w-3 h-0.5 bg-slate-300 rounded" />
            Glucose rise (mg/dL)
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Cause/Strategy bar ────────────────────────────────────────────────────────

function HorizontalBar({ value, max = 100, color }) {
  return (
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightBadge({ type }) {
  const cfg = {
    danger:  { icon: '⚠', bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'   },
    warning: { icon: '!',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    success: { icon: '✓',  bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200'},
    info:    { icon: 'i',  bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'  },
  }
  const c = cfg[type] || cfg.info
  return (
    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 border ${c.bg} ${c.text} ${c.border}`}>
      {c.icon}
    </span>
  )
}

function PatternCard({ pattern }) {
  const borderMap = {
    danger:  'border-red-200 bg-red-50/60',
    warning: 'border-amber-200 bg-amber-50/60',
    success: 'border-emerald-200 bg-emerald-50/60',
    info:    'border-blue-200 bg-blue-50/60',
  }
  return (
    <div className={`rounded-xl border p-4 ${borderMap[pattern.type] || borderMap.info}`}>
      <div className="flex items-start gap-3">
        <InsightBadge type={pattern.type} />
        <div>
          <p className="text-xs font-semibold text-slate-800 leading-snug">{pattern.title}</p>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{pattern.body}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Meal list row ─────────────────────────────────────────────────────────────

function MealRow({ meal, insight }) {
  const sev = severityMeta(insight.spike_severity)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex-shrink-0 w-8 text-center">
        <span className="text-[10px] font-mono text-slate-400">{meal.id.slice(-2)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">
          {meal.foods.slice(0, 2).map(f => f.name).join(' + ')}
          {meal.foods.length > 2 && ` +${meal.foods.length - 2}`}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">{meal.date?.slice(5)} · {meal.meal_type?.replace('_', ' ')}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-semibold" style={{ color: deltaColor(meal.glucose.delta) }}>
          +{meal.glucose.delta}
        </span>
        <span className="text-xs font-bold text-slate-700 w-8 text-right">{meal.glucose.peak}</span>
        {insight.spike ? (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: sev.bg, color: sev.color }}
          >
            {sev.label}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
            OK
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const insights = useInsights()
  const { stats, patterns, strategy_effectiveness, top_spike_causes, food_rankings } = insights

  const bestStrategy = strategy_effectiveness
    .filter(s => s.key !== 'no_strategy' && s.mealCount >= 3)
    .sort((a, b) => a.spikeRate - b.spikeRate)[0]

  const topCause = top_spike_causes[0]

  const worstFood = food_rankings.risky.sort((a, b) => b.avgDelta - a.avgDelta)[0]

  const heroStats = [
    {
      label: 'Avg Peak Glucose',
      value: stats.avgPeak,
      unit: 'mg/dL',
      sub: stats.avgPeak > 140 ? 'Above safe target' : 'Within range',
      color: stats.avgPeak > 140 ? '#F97316' : '#22C55E',
      bg: stats.avgPeak > 140 ? '#FFF7ED' : '#F0FDF4',
      icon: '📈',
    },
    {
      label: 'Spike Rate',
      value: `${stats.spikeRate}%`,
      sub: `${stats.spikeCount} of ${stats.count} meals`,
      color: stats.spikeRate > 50 ? '#EF4444' : '#F59E0B',
      bg: stats.spikeRate > 50 ? '#FEF2F2' : '#FFFBEB',
      icon: '⚡',
    },
    {
      label: 'Best Strategy',
      value: bestStrategy ? `${bestStrategy.spikeRate}%` : '—',
      unit: 'spike rate',
      sub: bestStrategy?.label || '—',
      color: '#3B82F6',
      bg: '#EFF6FF',
      icon: '🏆',
    },
    {
      label: 'Avg Delta',
      value: stats.avgDelta,
      unit: 'mg/dL',
      sub: stats.avgDelta > 50 ? 'High variability' : 'Moderate',
      color: deltaColor(stats.avgDelta),
      bg: '#F8FAFC',
      icon: '↕',
    },
  ]

  return (
    <div>
      {/* ── Hero Section ── */}
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Glucose Decode</h1>
          <p className="text-sm text-slate-500 mt-1">
            {cgmData.metadata.total_meals} meals · {cgmData.metadata.date_range.start} → {cgmData.metadata.date_range.end}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {heroStats.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="mb-6">
        <GlucoseTimeline meals={cgmData.meals} insights={insights} />
      </div>

      {/* ── Three-column section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Spike Causes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Top Spike Causes</h2>
          <p className="text-xs text-slate-400 mb-4">Frequency across {stats.spikeCount} spiked meals</p>
          <div className="space-y-3.5">
            {top_spike_causes.slice(0, 5).map(c => (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-700 truncate max-w-[160px]">{c.label}</span>
                  <span className="text-xs font-bold text-red-500 flex-shrink-0 ml-2">{c.pct}%</span>
                </div>
                <HorizontalBar value={c.pct} max={100} color="#EF4444" />
              </div>
            ))}
          </div>
          {topCause && (
            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider mb-1">Primary cause</p>
              <p className="text-xs font-semibold text-slate-800">{topCause.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">in {topCause.count} of {stats.spikeCount} spikes</p>
            </div>
          )}
        </div>

        {/* Strategy Effectiveness */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Strategy Effectiveness</h2>
          <p className="text-xs text-slate-400 mb-4">Spike rate by strategy used</p>
          <div className="space-y-3">
            {strategy_effectiveness
              .filter(s => !['any_pre_meal','any_post_meal'].includes(s.key))
              .sort((a, b) => a.spikeRate - b.spikeRate)
              .map(s => {
                const isWorst = s.key === 'no_strategy'
                const barColor = isWorst ? '#EF4444' : s.spikeRate <= 30 ? '#22C55E' : '#F59E0B'
                return (
                  <div key={s.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs truncate max-w-[160px] ${isWorst ? 'font-semibold text-red-700' : 'font-medium text-slate-700'}`}>
                        {s.label}
                      </span>
                      <span className={`text-xs font-bold flex-shrink-0 ml-2 ${isWorst ? 'text-red-600' : 'text-slate-700'}`}>
                        {s.spikeRate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HorizontalBar value={s.spikeRate} max={100} color={barColor} />
                      <span className="text-[10px] text-slate-400 flex-shrink-0">n={s.mealCount}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Food Risk */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Food Risk Profile</h2>
          <p className="text-xs text-slate-400 mb-4">By avg glucose delta when eaten</p>

          {[
            { label: 'Risky Foods',    foods: food_rankings.risky.slice(0, 3),    color: '#EF4444', bg: '#FEF2F2' },
            { label: 'Moderate Foods', foods: food_rankings.moderate.slice(0, 3),  color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Safe Foods',     foods: food_rankings.safe.filter(f=>f.gi>0).slice(0, 3), color: '#22C55E', bg: '#F0FDF4' },
          ].map(group => (
            <div key={group.label} className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: group.color }}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.foods.map(f => (
                  <div key={f.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-xs text-slate-700 truncate">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-slate-400">GI {f.gi}</span>
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: group.bg, color: group.color }}
                      >
                        +{f.avgDelta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {worstFood && (
            <div className="mt-3 pt-3 border-t border-slate-50">
              <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider mb-1">Highest impact</p>
              <p className="text-xs font-semibold text-red-700">{worstFood.name}</p>
              <p className="text-[11px] text-slate-500">GI {worstFood.gi} · avg +{worstFood.avgDelta} mg/dL delta</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Patterns + Meal Log ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Key patterns */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Pattern Insights</h2>
          <p className="text-xs text-slate-400 mb-4">Auto-detected across all meals</p>
          <div className="space-y-2.5">
            {patterns.slice(0, 5).map((p, i) => <PatternCard key={i} pattern={p} />)}
          </div>
        </div>

        {/* Meal log */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">All Meals</h2>
          <p className="text-xs text-slate-400 mb-4">
            Sorted chronologically · delta = glucose rise · peak in mg/dL
          </p>
          {/* Column headers */}
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100 mb-1">
            <span className="w-8 text-[10px] text-slate-400 font-medium">#</span>
            <span className="flex-1 text-[10px] text-slate-400 font-medium">Foods</span>
            <span className="text-[10px] text-slate-400 font-medium w-8 text-right">Δ</span>
            <span className="text-[10px] text-slate-400 font-medium w-8 text-right">Peak</span>
            <span className="text-[10px] text-slate-400 font-medium w-14 text-right">Status</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto pr-1">
            {cgmData.meals.map((meal, i) => (
              <MealRow key={meal.id} meal={meal} insight={insights.meal_insights[i]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
