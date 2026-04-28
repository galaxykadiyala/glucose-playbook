import { useState, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Legend, Cell,
} from 'recharts'
import analytics from '../data/fullAnalytics.json'
import { useStint } from '../context/StintContext'
import {
  scoreColor, glucoseColor, tirColor, todColor,
  getOvernightReadings, rollingAvgScore, shortDate, formatDelta,
} from '../utils/cgmAnalytics'
import { toZoneSegments, getZone, ZONE_COLORS, isSpikePeak } from '../utils/glucoseZones'
import Card, { CardHeader } from '../components/ui/Card'

// ─── Deep analytics components ────────────────────────────────────────────────

function PriorityIcon({ priority }) {
  if (priority === 'critical')     return <span className="text-red-500 font-bold text-xs flex-shrink-0">⚠</span>
  if (priority === 'moderate')     return <span className="text-amber-500 font-bold text-xs flex-shrink-0">→</span>
  return                                  <span className="text-blue-400 font-bold text-xs flex-shrink-0">ℹ</span>
}

function PriorityBadge({ priority }) {
  const map = {
    critical:      { bg: '#FEF2F2', text: '#DC2626', label: 'Critical' },
    moderate:      { bg: '#FFFBEB', text: '#D97706', label: 'Moderate' },
    informational: { bg: '#EFF6FF', text: '#2563EB', label: 'Info' },
  }
  const s = map[priority] || map.informational
  return (
    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function ExecutiveSummarySection({ exec, comparisonInsights }) {
  return (
    <div className="space-y-4">
      {/* Grade header */}
      <div className="flex items-center gap-3 p-4 rounded-xl"
        style={{ backgroundColor: scoreColor(exec.avg_score).bg, borderColor: scoreColor(exec.avg_score).border, border: '1px solid' }}>
        <div className="text-3xl font-extrabold" style={{ color: scoreColor(exec.avg_score).text }}>
          {exec.avg_score}
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: scoreColor(exec.avg_score).text }}>{exec.grade} Control</div>
          <div className="text-xs text-slate-500 mt-0.5">{exec.one_liner}</div>
        </div>
      </div>

      {/* Bullets */}
      <div className="space-y-2">
        {exec.bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-slate-400 w-4">{b.rank}.</span>
              <PriorityIcon priority={b.priority} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 leading-snug">{b.headline}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{b.detail}</p>
            </div>
            <PriorityBadge priority={b.priority} />
          </div>
        ))}
      </div>

      {/* Cross-phase comparison insights if provided */}
      {comparisonInsights?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Stint 2 → Stint 3 changes</p>
          <div className="space-y-1.5">
            {comparisonInsights.map((ins, i) => {
              const s = ins.priority === 'critical'
                ? { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' }
                : ins.priority === 'moderate'
                ? { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706' }
                : { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB' }
              return (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border text-xs leading-relaxed"
                  style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text }}>
                  <PriorityIcon priority={ins.priority} />
                  <span>{ins.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TrendSmoothingChart({ trendData }) {
  const chartData = trendData.trend_data.map(d => ({
    date:      shortDate(d.date),
    actual:    d.glucose_actual,
    avg3:      d.glucose_3day,
    avg7:      d.glucose_7day,
    score7:    d.score_7day,
  }))
  const t = trendData.intra_stint_trend
  const improving = t.direction === 'improving' || t.direction === 'slight_improvement'

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: improving ? '#F0FDF4' : t.direction === 'stable' ? '#F8FAFC' : '#FEF2F2',
                   color: improving ? '#16A34A' : t.direction === 'stable' ? '#64748B' : '#DC2626' }}>
          {t.label}
        </span>
        <span className="text-[11px] text-slate-400">
          Week 1 avg: {t.glucose_first7} → Week 2: {t.glucose_last7} mg/dL
          ({t.glucose_delta > 0 ? '+' : ''}{t.glucose_delta} mg/dL)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={2} />
          <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
          <ReferenceLine y={140} stroke="#FECACA" strokeDasharray="3 3" />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v, n) => [v ? `${v} mg/dL` : '—', { actual: 'Daily', avg3: '3-day avg', avg7: '7-day avg' }[n] || n]} />
          <Line type="monotone" dataKey="actual" stroke="#CBD5E1" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg3"   stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg7"   stroke="#3B82F6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Legend formatter={n => ({ actual: 'Daily', avg3: '3-day avg', avg7: '7-day avg' }[n] || n)}
            iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ScoreBreakdownChart({ scoreBreakdowns }) {
  const chartData = scoreBreakdowns.map(d => ({
    date:        shortDate(d.date),
    tir:         d.components.tir_inRange.score,
    avg_glucose: d.components.avg_glucose.score,
    variability: d.components.variability.score,
    spikes:      d.components.spikes.score,
    total:       d.score,
  }))

  const COLORS = { tir: '#22C55E', avg_glucose: '#3B82F6', variability: '#F59E0B', spikes: '#EF4444' }

  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-2">
        Stacked = score components. Max 100 = TIR (40) + Avg Glucose (25) + Variability (20) + Spikes (15).
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={2} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
          <ReferenceLine y={80} stroke="#BBF7D0" strokeDasharray="3 3" />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
            formatter={(v, n) => [v, { tir: 'TIR (max 40)', avg_glucose: 'Avg Glucose (max 25)', variability: 'Variability (max 20)', spikes: 'Spikes (max 15)' }[n] || n]} />
          <Bar dataKey="tir"         stackId="a" fill={COLORS.tir}         isAnimationActive={false} />
          <Bar dataKey="avg_glucose" stackId="a" fill={COLORS.avg_glucose} isAnimationActive={false} />
          <Bar dataKey="variability" stackId="a" fill={COLORS.variability} isAnimationActive={false} />
          <Bar dataKey="spikes"      stackId="a" fill={COLORS.spikes}      isAnimationActive={false} radius={[3, 3, 0, 0]} />
          <Legend formatter={n => ({ tir: 'TIR', avg_glucose: 'Avg Glucose', variability: 'Variability', spikes: 'Spikes' }[n] || n)}
            iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function HeatmapSection({ heatmapData, dates }) {
  const BUCKETS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24']
  const LABELS  = { '00-04': '12a–4a', '04-08': '4a–8a', '08-12': '8a–12p', '12-16': '12p–4p', '16-20': '4p–8p', '20-24': '8p–12a' }

  function glucoseToColor(v) {
    if (!v) return '#F8FAFC'
    if (v < 100) return '#DCFCE7'
    if (v < 120) return '#BBF7D0'
    if (v < 140) return '#FDE68A'
    if (v < 160) return '#FDBA74'
    if (v < 180) return '#FCA5A5'
    return '#F87171'
  }

  const cellMap = {}
  for (const c of heatmapData.cells) {
    cellMap[`${c.date}__${c.bucket}`] = c.avg
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-[10px] text-slate-500">
        {[['<100','#DCFCE7'],['100–120','#BBF7D0'],['120–140','#FDE68A'],['140–160','#FDBA74'],['160–180','#FCA5A5'],['>180','#F87171']].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: c }} />
            {l}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="text-[9px] border-separate" style={{ borderSpacing: '1px' }}>
          <thead>
            <tr>
              <th className="text-slate-400 font-normal pr-2 text-left w-14">Period</th>
              {dates.map(d => (
                <th key={d} className="text-slate-400 font-normal text-center" style={{ minWidth: 24 }}>
                  {shortDate(d).split(' ')[1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUCKETS.map(bucket => (
              <tr key={bucket}>
                <td className="text-slate-500 pr-2 py-0.5 font-medium">{LABELS[bucket]}</td>
                {dates.map(d => {
                  const val = cellMap[`${d}__${bucket}`]
                  return (
                    <td key={d}
                      className="rounded text-center font-semibold"
                      style={{ backgroundColor: glucoseToColor(val), color: '#374151', minWidth: 24, height: 20 }}
                      title={val ? `${d} ${LABELS[bucket]}: ${val} mg/dL` : 'No data'}>
                      {val ?? ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
        <span>Highest period: <strong className="text-slate-700">{heatmapData.highest_period.label}</strong> ({heatmapData.highest_period.avg} mg/dL avg)</span>
        <span>Lowest: <strong className="text-slate-700">{heatmapData.lowest_period.label}</strong> ({heatmapData.lowest_period.avg} mg/dL avg)</span>
      </div>
    </div>
  )
}

function AnomalyTimeline({ anomalyDetection, dailySummaries }) {
  const anomalous = anomalyDetection.days.filter(d => d.is_anomalous)

  if (anomalous.length === 0)
    return <p className="text-xs text-slate-400">No anomalous days detected in this stint.</p>

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-slate-500 mb-2">
        {anomalyDetection.anomaly_count} anomalous days ({anomalyDetection.anomaly_rate}% of stint).
        Flagged when 2+ SD from stint mean on any key metric.
      </div>
      {anomalous.map(day => {
        const daily = dailySummaries.find(d => d.date === day.date)
        return (
          <div key={day.date} className="p-3 rounded-xl bg-red-50 border border-red-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-700">{shortDate(day.date)}</span>
                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{day.label}</span>
              </div>
              <span className="text-xs font-bold text-red-600">Score: {day.score}</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {day.flags.map((f, i) => (
                <span key={i} className="text-[10px] bg-white border border-red-200 text-red-700 px-2 py-0.5 rounded-full">
                  {f.label}
                </span>
              ))}
            </div>
            {day.flags.map((f, i) => (
              <p key={i} className="text-[10px] text-red-500 leading-relaxed">{f.detail}</p>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function BadDayPatternSection({ patterns }) {
  const bg = patterns.bad_vs_good
  const metrics = [
    { label: 'Avg Glucose', bad: `${bg.avg_glucose.bad} mg/dL`, good: `${bg.avg_glucose.good} mg/dL`, diff: `+${bg.avg_glucose.diff}` },
    { label: 'Spikes/day',  bad: bg.avg_spikes.bad, good: bg.avg_spikes.good, diff: `+${bg.avg_spikes.diff}` },
    { label: 'Variability', bad: `SD ${bg.avg_sd.bad}`, good: `SD ${bg.avg_sd.good}`, diff: `+${bg.avg_sd.diff}` },
  ]

  return (
    <div>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
        <p className="text-xs text-amber-800 leading-relaxed font-medium">{patterns.pattern_text}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {metrics.map((m, i) => (
          <div key={i} className="text-center">
            <div className="text-[10px] text-slate-400 mb-1">{m.label}</div>
            <div className="text-xs font-bold text-red-600">{m.bad}</div>
            <div className="text-[10px] text-slate-300 my-0.5">bad days</div>
            <div className="text-xs font-bold text-emerald-600">{m.good}</div>
            <div className="text-[10px] text-slate-300 my-0.5">good days</div>
            <div className="text-xs font-semibold text-slate-600">{m.diff} difference</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">Worst days</p>
          {patterns.bad_days.map(d => (
            <div key={d.date} className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-xs text-slate-600">{shortDate(d.date)}</span>
              <span className="text-xs font-bold text-red-600">Score {d.score}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">Best days</p>
          {patterns.good_days.map(d => (
            <div key={d.date} className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-xs text-slate-600">{shortDate(d.date)}</span>
              <span className="text-xs font-bold text-emerald-600">Score {d.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PrioritizedInsightsSection({ prioritized }) {
  const PRIORITY_ORDER = ['critical', 'moderate', 'informational']
  const grouped = PRIORITY_ORDER.reduce((acc, p) => {
    acc[p] = prioritized.insights.filter(i => i.priority === p)
    return acc
  }, {})

  const styles = {
    critical:      { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', hdr: '#FEE2E2', label: 'Critical' },
    moderate:      { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', hdr: '#FEF3C7', label: 'Moderate' },
    informational: { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB', hdr: '#DBEAFE', label: 'Informational' },
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-[11px]">
        {PRIORITY_ORDER.map(p => (
          grouped[p].length > 0 && (
            <span key={p} className="px-2 py-1 rounded-full font-medium"
              style={{ backgroundColor: styles[p].hdr, color: styles[p].text }}>
              {styles[p].label}: {grouped[p].length}
            </span>
          )
        ))}
      </div>

      {PRIORITY_ORDER.map(priority => grouped[priority].length > 0 && (
        <div key={priority}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: styles[priority].text }}>
            {styles[priority].label}
          </p>
          <div className="space-y-2">
            {grouped[priority].map((ins, i) => (
              <div key={i} className="rounded-lg border p-3"
                style={{ backgroundColor: styles[priority].bg, borderColor: styles[priority].border }}>
                <div className="flex items-start gap-2">
                  <PriorityIcon priority={priority} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: styles[priority].text }}>{ins.text}</p>
                    {ins.action && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        <span className="font-semibold">Action: </span>{ins.action}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 flex-shrink-0">[{ins.category}]</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DeepAnalyticsTab({ phaseData, comparisonInsights }) {
  const deep = phaseData.deep

  if (!deep) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Deep analysis not yet available</p>
        <p className="text-xs text-slate-400 mt-1">Pre-computed analytics pipeline coming soon.</p>
      </div>
    )
  }

  const dates = phaseData.daily_summaries.map(d => d.date)

  return (
    <div className="space-y-5">
      {/* Executive summary */}
      <Card>
        <CardHeader title="Executive Summary" subtitle="Top 7 high-impact insights, ranked by priority" />
        <ExecutiveSummarySection exec={deep.executive_summary} comparisonInsights={comparisonInsights} />
      </Card>

      {/* Trend smoothing + score breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Trend Smoothing" subtitle="3-day · 7-day rolling averages · intra-stint direction" />
          <TrendSmoothingChart trendData={deep.trend_smoothing} />
        </Card>
        <Card>
          <CardHeader title="Score Component Breakdown" subtitle="What's driving each day's score — stacked by component" />
          <ScoreBreakdownChart scoreBreakdowns={deep.score_breakdowns} />
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader title="Glucose Heatmap" subtitle="Day × time-of-day · color = avg glucose in that window" />
        <HeatmapSection heatmapData={deep.heatmap_data} dates={dates} />
      </Card>

      {/* Bad day patterns + anomalies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Bad Day Pattern Analysis"
            subtitle={`Bottom 20% days (score ≤${Math.min(...deep.bad_day_patterns.bad_days.map(d=>d.score))}) vs best days`} />
          <BadDayPatternSection patterns={deep.bad_day_patterns} />
        </Card>
        <Card>
          <CardHeader title="Anomaly Detection"
            subtitle={`${deep.anomaly_detection.anomaly_count} flagged · threshold: 2 SD from stint mean`} />
          <AnomalyTimeline anomalyDetection={deep.anomaly_detection} dailySummaries={phaseData.daily_summaries} />
        </Card>
      </div>

      {/* Prioritized insights */}
      <Card>
        <CardHeader title="Prioritized Insights"
          subtitle={`${deep.prioritized_insights.critical_count} critical · ${deep.prioritized_insights.moderate_count} moderate · ${deep.prioritized_insights.info_count} informational`} />
        <PrioritizedInsightsSection prioritized={deep.prioritized_insights} />
      </Card>
    </div>
  )
}

const PHASES = [
  { id: 'phase_2', label: 'Stint 2', shortLabel: 'Feb 28–Mar 15' },
  { id: 'phase_3', label: 'Stint 3', shortLabel: 'Mar 15–Mar 30' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreDial({ score, size = 'md' }) {
  const { text, bg, border, label } = scoreColor(score)
  const dim = size === 'sm' ? 'w-14 h-14' : 'w-24 h-24'
  const textSize = size === 'sm' ? 'text-xl' : 'text-3xl'
  return (
    <div className={`${dim} rounded-full flex flex-col items-center justify-center border-4 flex-shrink-0`}
      style={{ borderColor: border, backgroundColor: bg }}>
      <span className={`${textSize} font-extrabold leading-none`} style={{ color: text }}>{score}</span>
      {size !== 'sm' && <span className="text-[10px] font-semibold mt-0.5" style={{ color: text }}>{label}</span>}
    </div>
  )
}

function StatBox({ label, value, unit = '', color = '#1E293B', sub = '' }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <div className="text-xl font-bold leading-tight" style={{ color }}>
        {value}<span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  )
}

function TIRBar({ tir }) {
  const keys = ['low', 'inRange', 'elevated', 'high']
  return (
    <div className="w-full">
      <div className="flex h-4 rounded-full overflow-hidden gap-px">
        {keys.map(key => tir[key] > 0 && (
          <div key={key} style={{ width: `${tir[key]}%`, backgroundColor: tirColor(key).fill }}
            title={`${tirColor(key).label}: ${tir[key]}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {keys.map(key => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tirColor(key).fill }} />
            {tirColor(key).label.split(' ')[0]} {tir[key]}%
          </span>
        ))}
      </div>
    </div>
  )
}

function InsightTag({ type, text }) {
  const styles = {
    success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', icon: '✓' },
    danger:  { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', icon: '✗' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', icon: '⚠' },
    info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#2563EB', icon: 'ℹ' },
  }
  const s = styles[type] || styles.info
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border" style={{ backgroundColor: s.bg, borderColor: s.border }}>
      <span className="text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: s.text }}>{s.icon}</span>
      <p className="text-xs leading-relaxed" style={{ color: s.text }}>{text}</p>
    </div>
  )
}

// ─── Zone-aware glucose tooltip ───────────────────────────────────────────────

function GlucoseTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  // With zone segments, find the first non-null value across stable/elevated/spike keys
  const entry = payload.find(p => p.value != null)
  if (!entry) return null
  const val = entry.value
  const zone = getZone(val)
  const zc   = ZONE_COLORS[zone] ?? {}
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 shadow-md text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      <div className="font-bold" style={{ color: zc.stroke }}>{val} mg/dL</div>
      <div className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5">{zc.label}</div>
    </div>
  )
}

// ─── Overnight chart (zone-coloured) ─────────────────────────────────────────

function OvernightChart({ readings, overnightMeta }) {
  const data = useMemo(() => readings.map(r => ({
    time:    r.timestamp.slice(11, 16),
    glucose: r.glucose,
  })), [readings])

  const zoneData = useMemo(() => toZoneSegments(data), [data])

  if (data.length === 0)
    return <div className="h-24 flex items-center justify-center text-xs text-slate-400">No overnight data</div>

  const values  = data.map(d => d.glucose).filter(Boolean)
  const yMin    = Math.max(55, Math.min(...values) - 8)
  const yMax    = Math.min(240, Math.max(...values) + 18)

  // Spike peak dot — only renders at local maxima in the spike zone
  const spikePeakDot = (props) => {
    const { cx, cy, index } = props
    if (cx == null || !isSpikePeak(zoneData, index)) return null
    return <circle key={`spk-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} />
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatBox label="Avg"  value={overnightMeta.avg_overnight}  unit=" mg/dL" />
        <StatBox label="Low"  value={overnightMeta.min_overnight}  unit=" mg/dL" color="#3B82F6" />
        <StatBox label="High" value={overnightMeta.max_overnight}  unit=" mg/dL"
          color={overnightMeta.max_overnight > 160 ? '#DC2626' : '#64748B'} />
        <StatBox label="SD"   value={overnightMeta.variability_sd} color="#8B5CF6" />
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={zoneData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>

          {/* ── Background zone bands ── */}
          <ReferenceArea y1={yMin} y2={120}  fill="#22c55e" fillOpacity={0.07} ifOverflow="hidden" />
          <ReferenceArea y1={120}  y2={140}  fill="#eab308" fillOpacity={0.09} ifOverflow="hidden" />
          <ReferenceArea y1={140}  y2={yMax} fill="#ef4444" fillOpacity={0.07} ifOverflow="hidden" />

          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="time"
            tick={{ fontSize: 9, fill: '#94A3B8' }} interval={5}
            tickLine={false} axisLine={false} />
          <YAxis domain={[yMin, yMax]}
            tick={{ fontSize: 9, fill: '#94A3B8' }}
            tickLine={false} axisLine={false} />

          {/* ── Zone boundary lines ── */}
          <ReferenceLine y={120} stroke="#22c55e" strokeDasharray="3 4" strokeOpacity={0.5} strokeWidth={1} />
          <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="3 4" strokeOpacity={0.65} strokeWidth={1} />

          <Tooltip content={<GlucoseTooltip />} />

          {/* ── Zone lines ── */}
          <Line type="monotone" dataKey="stable"
            stroke={ZONE_COLORS.stable.stroke}   strokeWidth={2.5}
            dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="elevated"
            stroke={ZONE_COLORS.elevated.stroke} strokeWidth={2.5}
            dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="spike"
            stroke={ZONE_COLORS.spike.stroke}    strokeWidth={2.5}
            dot={spikePeakDot} connectNulls={false} isAnimationActive={false} />

          {/* ── Legend ── */}
          <Legend
            iconType="line" iconSize={14}
            wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
            formatter={name => ({
              stable:   'Stable ≤120',
              elevated: 'Elevated 121–140',
              spike:    'Spike >140',
            }[name] ?? name)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Score trend ──────────────────────────────────────────────────────────────

function ScoreTrend({ dailySummaries }) {
  const trendData = useMemo(() => rollingAvgScore(
    dailySummaries.map(d => ({ date: d.date, score: d.score }))
  ), [dailySummaries])

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
          tickFormatter={shortDate} interval={2} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
        <ReferenceLine y={80} stroke="#BBF7D0" strokeDasharray="4 2" />
        <Tooltip formatter={(v, n) => [v, n === 'score' ? 'Daily' : '7-day avg']}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
          labelFormatter={shortDate} />
        <Line type="monotone" dataKey="score"      stroke="#CBD5E1" strokeWidth={1.5}
          dot={{ r: 3, fill: '#fff', stroke: '#CBD5E1', strokeWidth: 1.5 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="rollingAvg" stroke="#3B82F6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── TOD breakdown ────────────────────────────────────────────────────────────

function TODBreakdown({ todData }) {
  const max = Math.max(...todData.map(t => t.avg_glucose ?? 0))
  return (
    <div className="space-y-2">
      {todData.map(t => {
        const { fill } = todColor(t.period.toLowerCase())
        const pct = max > 0 ? Math.round((t.avg_glucose / max) * 100) : 0
        return (
          <div key={t.period} className="flex items-center gap-3">
            <div className="w-20 text-xs text-slate-600 flex-shrink-0">{t.label ?? t.period}</div>
            <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
              <div className="h-full rounded-lg flex items-center px-2.5" style={{ width: `${pct}%`, backgroundColor: fill, minWidth: 48 }}>
                <span className="text-[11px] text-white font-semibold">{t.avg_glucose}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 w-16 text-right flex-shrink-0">
              {t.spike_count} spike{t.spike_count !== 1 ? 's' : ''} · {t.spike_share}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Spike distribution bar ───────────────────────────────────────────────────

function SpikesByTOD({ spikeList }) {
  const groups = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const s of spikeList) groups[s.time_of_day] = (groups[s.time_of_day] || 0) + 1

  const data = Object.entries(groups).map(([key, count]) => ({
    name: todColor(key).label, count, fill: todColor(key).fill, key,
  }))

  const avgRise = spikeList.length
    ? Math.round(spikeList.reduce((a, s) => a + s.rise, 0) / spikeList.length)
    : 0

  return (
    <div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [v, 'Spikes']}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }} />
          {data.map(d => (
            <Bar key={d.key} dataKey="count" data={[d]} fill={d.fill} radius={[4, 4, 0, 0]} barSize={32} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
        <span>Total: <span className="font-semibold text-slate-600">{spikeList.length}</span></span>
        <span>Avg rise: <span className="font-semibold text-slate-600">{avgRise} mg/dL</span></span>
        <span>Worst: <span className="font-semibold text-red-500">
          {spikeList.length ? Math.max(...spikeList.map(s => s.peak_glucose)) : '—'} mg/dL
        </span></span>
      </div>
    </div>
  )
}

// ─── Phase comparison panel ───────────────────────────────────────────────────

function ComparisonPanel() {
  const { comparison } = analytics
  const { changes, comparison_insights, phase_2_summary: p2, phase_3_summary: p3,
    tod_comparison, score_comparison } = comparison

  const metricRows = [
    { label: 'Avg Glucose',  p2: `${p2.avg_glucose} mg/dL`, p3: `${p3.avg_glucose} mg/dL`, change: changes.avg_glucose },
    { label: 'TIR (70–140)', p2: `${p2.time_in_range.inRange}%`,  p3: `${p3.time_in_range.inRange}%`,  change: changes.tir_inRange },
    { label: 'Variability',  p2: `CV ${p2.variability.cv}%`,  p3: `CV ${p3.variability.cv}%`,  change: changes.variability_cv },
    { label: 'Spikes',       p2: `${p2.spike_count}`,          p3: `${p3.spike_count}`,          change: changes.spike_count },
    { label: 'Avg Score',    p2: `${p2.avg_score}/100`,         p3: `${p3.avg_score}/100`,         change: changes.avg_score },
    { label: 'Overnight avg',p2: `${comparison.overnight_comparison.phase_2.avg_overnight_glucose} mg/dL`,
                              p3: `${comparison.overnight_comparison.phase_3.avg_overnight_glucose} mg/dL`,
                              change: changes.overnight_avg_glucose },
  ]

  return (
    <div>
      {/* Metric table */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-4 text-slate-400 font-medium">Metric</th>
              <th className="text-center py-2 px-3 text-blue-600 font-semibold">Stint 2</th>
              <th className="text-center py-2 px-3 text-purple-600 font-semibold">Stint 3</th>
              <th className="text-center py-2 pl-3 text-slate-400 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="py-2.5 pr-4 text-slate-600 font-medium">{row.label}</td>
                <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{row.p2}</td>
                <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{row.p3}</td>
                <td className="py-2.5 pl-3 text-center">
                  <span className="font-bold text-[11px]" style={{
                    color: row.change.direction === 'improved' ? '#16A34A'
                         : row.change.direction === 'worsened' ? '#DC2626' : '#64748B'
                  }}>
                    {row.change.formatted}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score trend comparison */}
      <div className="mb-5">
        <p className="text-[11px] text-slate-500 mb-2">Score trend — Stint 2 <span className="text-blue-500">vs</span> Stint 3 <span className="text-purple-500">(by day index)</span></p>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={score_comparison} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false}
              tickFormatter={d => `Day ${d}`} interval={3} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
            <ReferenceLine y={80} stroke="#BBF7D0" strokeDasharray="3 3" />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
              formatter={(v, n) => [v ?? '—', n === 'phase_2' ? 'Stint 2' : 'Stint 3']}
              labelFormatter={d => `Day ${d}`} />
            <Line type="monotone" dataKey="phase_2" stroke="#3B82F6" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="phase_3" stroke="#8B5CF6" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} strokeDasharray="4 2" />
            <Legend formatter={n => n === 'phase_2' ? 'Stint 2' : 'Stint 3'} iconSize={10}
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TOD comparison bars */}
      <div className="mb-5">
        <p className="text-[11px] text-slate-500 mb-2">Time-of-day avg glucose — Stint 2 vs Stint 3</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={tod_comparison} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[80, 140]} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
              formatter={(v, n) => [`${v} mg/dL`, n === 'phase_2' ? 'Stint 2' : 'Stint 3']} />
            <Bar dataKey="phase_2" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} isAnimationActive={false} />
            <Bar dataKey="phase_3" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={20} isAnimationActive={false} />
            <Legend formatter={n => n === 'phase_2' ? 'Stint 2' : 'Stint 3'} iconSize={10}
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="space-y-2">
        {comparison_insights.map((ins, i) => (
          <InsightTag key={i} type={ins.type} text={`[${ins.metric}] ${ins.text}`} />
        ))}
      </div>
    </div>
  )
}

// ─── Day list ─────────────────────────────────────────────────────────────────

function DayRow({ day, isSelected, onSelect }) {
  const sc = scoreColor(day.score)
  return (
    <button onClick={() => onSelect(day.date)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
      }`}
    >
      <ScoreDial score={day.score} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800">{shortDate(day.date)}</span>
          <span className="text-[10px] text-slate-400">TIR {day.tir_inRange}%</span>
        </div>
        <p className="text-[10px] text-slate-500 truncate">{day.insight}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs font-bold text-slate-700">{day.avg_glucose}</div>
        <div className="text-[10px] text-slate-400">mg/dL</div>
      </div>
      {day.spike_count > 0 && (
        <div className="bg-red-50 text-red-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
          {day.spike_count}⚡
        </div>
      )}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DailyIntelligence() {
  const { stints, selectedStintId, setSelectedStintId, stintPhaseData, hasData } = useStint()

  const [activePhase, setActivePhase]   = useState('phase_2')
  const [activeTab,   setActiveTab]     = useState('overview')
  const [selectedDate, setSelectedDate] = useState(null)

  // Use live Supabase data when available, fall back to hardcoded
  const phaseData = hasData && stintPhaseData
    ? stintPhaseData
    : analytics.datasets[activePhase]

  // Phase selector options
  const phaseOptions = hasData && stints.length > 0
    ? stints.map(s => ({ id: s.id, label: s.name, shortLabel: `${s.start_date} – ${s.end_date}` }))
    : PHASES
  const currentPhaseId = hasData ? selectedStintId : activePhase
  const handlePhaseChange = (id) => {
    if (hasData) setSelectedStintId(id)
    else setActivePhase(id)
    setSelectedDate(null)
  }

  const { daily_summaries, overnight_analysis, spike_list, tod_breakdown,
    best_days, worst_days, text_insights, overnight_summary } = phaseData

  const latestDay    = daily_summaries[daily_summaries.length - 1]
  const displayDate  = selectedDate || latestDay.date
  const displayDay   = daily_summaries.find(d => d.date === displayDate) || latestDay
  const displayON    = overnight_analysis.find(o => o.date === displayDate)

  const rawReadings = useMemo(() => {
    return phaseData.chart_data.glucose_timeline
      .filter(r => r.t.slice(0, 10) === displayDate || (
        r.t.slice(0, 10) === (() => {
          const d = new Date(displayDate); d.setDate(d.getDate() - 1)
          return d.toISOString().slice(0, 10)
        })() && parseInt(r.t.slice(11, 13)) >= 22
      ))
      .map(r => ({ timestamp: r.t, glucose: r.g }))
  }, [displayDate, phaseData])

  const avgScore = Math.round(daily_summaries.reduce((a, d) => a + d.score, 0) / daily_summaries.length)
  const maxScore = Math.max(...daily_summaries.map(d => d.score))
  const minScore = Math.min(...daily_summaries.map(d => d.score))

  return (
    <div>
      {/* Top tabs */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'overview' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}>
            Overview
          </button>
          <button onClick={() => setActiveTab('deep')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'deep' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}>
            Deep Analysis
          </button>
          <button onClick={() => setActiveTab('compare')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'compare' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}>
            Comparison
          </button>
        </div>

        {(activeTab === 'overview' || activeTab === 'deep') && (
          <div className="flex gap-2 flex-wrap">
            {phaseOptions.map(p => (
              <button key={p.id} onClick={() => handlePhaseChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentPhaseId === p.id
                    ? 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}>
                {p.label} <span className="text-slate-400">{p.shortLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'compare' ? (
        /* ── Comparison tab ─────────────────────────────────────────────── */
        <Card>
          <CardHeader title="Stint 2 vs Stint 3" subtitle="Full comparison across all metrics, charts, and text insights" />
          <ComparisonPanel />
        </Card>
      ) : activeTab === 'deep' ? (
        /* ── Deep analysis tab ──────────────────────────────────────────── */
        <DeepAnalyticsTab
          phaseData={analytics.datasets[activePhase]}
          comparisonInsights={activePhase === 'phase_3' ? analytics.deep_comparison?.insights : undefined}
        />
      ) : (
        /* ── Overview tab ───────────────────────────────────────────────── */
        <>
          {/* Hero section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

            {/* Day score + TIR */}
            <Card className="md:col-span-2">
              <div className="flex items-start gap-5 mb-4">
                <ScoreDial score={displayDay.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-slate-900">{shortDate(displayDay.date)}</h2>
                    {displayDay.date === latestDay.date && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Latest</span>
                    )}
                    {displayDay.date === best_days[0]?.date && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Best day</span>
                    )}
                    {displayDay.date === worst_days[0]?.date && (
                      <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Worst day</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">{displayDay.insight}</p>
                  <TIRBar tir={{
                    low: phaseData.overnight_analysis.length > 0 ? 0 : 0,
                    inRange:  displayDay.tir_inRange,
                    elevated: displayDay.tir_elevated,
                    high:     displayDay.tir_high,
                  }} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <StatBox label="Avg Glucose" value={displayDay.avg_glucose} unit=" mg/dL"
                  color={glucoseColor(displayDay.avg_glucose).text} />
                <StatBox label="Max Glucose" value={displayDay.max_glucose} unit=" mg/dL"
                  color={displayDay.max_glucose > 180 ? '#DC2626' : '#64748B'} />
                <StatBox label="Variability" value={displayDay.sd} unit=" SD"
                  color={displayDay.sd > 25 ? '#D97706' : '#16A34A'} />
                <StatBox label="Spikes" value={displayDay.spike_count}
                  color={displayDay.spike_count > 3 ? '#DC2626' : displayDay.spike_count > 1 ? '#D97706' : '#16A34A'} />
              </div>
            </Card>

            {/* Overnight */}
            <Card>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">Overnight</h3>
                {displayON?.dawn_phenomenon && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Dawn effect</span>
                )}
              </div>
              {displayON ? (
                <>
                  <p className="text-xs text-slate-500 mb-2 leading-relaxed">{displayON.insight}</p>
                  <OvernightChart readings={rawReadings} overnightMeta={displayON} />
                </>
              ) : (
                <p className="text-xs text-slate-400">No overnight data for this day.</p>
              )}
            </Card>
          </div>

          {/* Score trend + Spike distribution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <Card className="md:col-span-2">
              <CardHeader title="Daily Score Trend" subtitle="Gray bars = daily score · Blue line = 7-day rolling average" />
              <ScoreTrend dailySummaries={daily_summaries} />
              <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
                <span>Avg: <strong className="text-slate-600">{avgScore}</strong></span>
                <span>Best: <strong className="text-slate-600">{maxScore}</strong></span>
                <span>Worst: <strong className="text-slate-600">{minScore}</strong></span>
              </div>
            </Card>

            <Card>
              <CardHeader title="Spikes by Period" subtitle={`${spike_list.length} total across ${daily_summaries.length} days`} />
              <SpikesByTOD spikeList={spike_list} />
            </Card>
          </div>

          {/* TOD + overnight summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Card>
              <CardHeader title="Avg Glucose by Time of Day" subtitle="Based on all readings across the full stint" />
              <TODBreakdown todData={tod_breakdown} />
            </Card>

            <Card>
              <CardHeader title="Overnight Summary" subtitle={`${overnight_summary.stable_nights} stable · ${overnight_summary.unstable_nights} unstable · ${overnight_summary.dawn_phenomenon_count} dawn events`} />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <StatBox label="Avg overnight" value={overnight_summary.avg_overnight_glucose} unit=" mg/dL"
                  color={glucoseColor(overnight_summary.avg_overnight_glucose).text} />
                <StatBox label="Avg overnight SD" value={overnight_summary.avg_overnight_sd}
                  color={overnight_summary.avg_overnight_sd > 15 ? '#D97706' : '#16A34A'} />
                <StatBox label="Stable nights" value={overnight_summary.stable_nights}
                  sub={`of ${daily_summaries.length} total`} color="#16A34A" />
                <StatBox label="Dawn phenomenon" value={`${overnight_summary.dawn_pct}%`}
                  sub="of nights" color={overnight_summary.dawn_pct > 50 ? '#D97706' : '#64748B'} />
              </div>
              {overnight_summary.dawn_pct > 50 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 leading-relaxed">
                  Dawn phenomenon present on {overnight_summary.dawn_pct}% of nights — early morning cortisol-driven glucose rise. Consider earlier dinner or lower-GI evening meals.
                </div>
              )}
            </Card>
          </div>

          {/* Text insights */}
          <Card className="mb-5">
            <CardHeader title="Key Insights" subtitle={`${phaseData.label} · ${phaseData.date_label}`} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {text_insights.map((ins, i) => <InsightTag key={i} type={ins.type} text={ins.text} />)}
            </div>
          </Card>

          {/* Best / worst days */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <Card>
              <CardHeader title="Best Days" subtitle="Highest metabolic health scores" />
              <div className="space-y-2">
                {best_days.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-emerald-50 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {d.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{shortDate(d.date)}</div>
                      <div className="text-[10px] text-slate-500 truncate">{d.insight}</div>
                    </div>
                    <div className="text-xs text-emerald-700 font-medium flex-shrink-0">{d.avg} mg/dL</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Worst Days" subtitle="Lowest metabolic health scores" />
              <div className="space-y-2">
                {worst_days.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-red-50 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {d.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{shortDate(d.date)}</div>
                      <div className="text-[10px] text-slate-500 truncate">{d.insight}</div>
                    </div>
                    <div className="text-xs text-red-600 font-medium flex-shrink-0">{d.avg} mg/dL</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Day list */}
          <Card>
            <CardHeader title="All Days" subtitle="Click any day to update panels above" />
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {[...daily_summaries].reverse().map(day => (
                <DayRow key={day.date} day={day} isSelected={day.date === displayDate} onSelect={setSelectedDate} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
