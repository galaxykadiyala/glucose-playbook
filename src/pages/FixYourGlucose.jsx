import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import analytics from '../data/fullAnalytics.json'
import { scoreColor } from '../utils/cgmAnalytics'
import Card, { CardHeader } from '../components/ui/Card'

const rec        = analytics.recommendations
const dash       = rec.action_dashboard
const issues     = rec.issues
const rules      = rec.personalized_rules
const phaseChange = rec.phase_change_analysis
const sim        = rec.impact_simulation
const feedback   = rec.feedback_loop

// ─── Shared primitives ────────────────────────────────────────────────────────

function PriorityBadge({ priority }) {
  const map = {
    HIGH:   { bg: '#FEF2F2', text: '#DC2626', label: 'HIGH' },
    MEDIUM: { bg: '#FFFBEB', text: '#D97706', label: 'MEDIUM' },
    LOW:    { bg: '#F0FDF4', text: '#16A34A', label: 'LOW' },
  }
  const s = map[priority] || map.LOW
  return (
    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function ConfidenceBadge({ confidence }) {
  const map = {
    HIGH:   { bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E', label: 'High confidence' },
    MEDIUM: { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B', label: 'Medium confidence' },
    LOW:    { bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8', label: 'Low confidence' },
  }
  const s = map[confidence] || map.LOW
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  )
}

function DifficultyPill({ difficulty }) {
  const colors = {
    LOW:    'bg-emerald-50 text-emerald-700',
    MEDIUM: 'bg-amber-50 text-amber-700',
    HIGH:   'bg-rose-50 text-rose-700',
  }
  return (
    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${colors[difficulty] || colors.LOW}`}>
      {difficulty} effort
    </span>
  )
}

// ─── Hero: Score Recovery Banner ──────────────────────────────────────────────

function ScoreRecoveryBanner() {
  const currentScore  = sim.current_state.score
  const optimizedScore = sim.combined_projection.score
  const curr  = scoreColor(currentScore)
  const opt   = scoreColor(optimizedScore)
  const phaseTwoScore = dash.expected_score_recovery.phase_2_score

  return (
    <div className="rounded-2xl border p-5 space-y-4"
      style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Score journey */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Now</div>
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl border-2"
              style={{ backgroundColor: curr.bg, borderColor: curr.border, color: curr.text }}>
              {currentScore}
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="text-slate-300 text-base">→</div>
            <div className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">14 days</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Projected</div>
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl border-2"
              style={{ backgroundColor: opt.bg, borderColor: opt.border, color: opt.text }}>
              {optimizedScore}
            </div>
          </div>
          {phaseTwoScore && (
            <>
              <div className="text-slate-200 text-xs">(P2 ref: {phaseTwoScore})</div>
            </>
          )}
        </div>

        {/* Text */}
        <div>
          <div className="text-sm font-bold text-slate-800 mb-1">
            +{optimizedScore - currentScore} point projected improvement with all 3 actions
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            {dash.expected_score_recovery.reasoning}
          </div>
        </div>
      </div>

      {/* Score breakdown bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Current: {currentScore}</span>
          <span>Optimized: {optimizedScore}</span>
        </div>
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
          {/* Current fill */}
          <div className="absolute left-0 top-0 h-full rounded-full transition-all"
            style={{ width: `${currentScore}%`, backgroundColor: curr.text, opacity: 0.4 }} />
          {/* Projected fill */}
          <div className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${optimizedScore}%`, backgroundColor: opt.text, opacity: 0.25 }} />
          {/* Current marker */}
          <div className="absolute top-0 h-full w-0.5 bg-slate-400"
            style={{ left: `${currentScore}%` }} />
        </div>
        <div className="text-[10px] text-slate-500 text-center">
          Simulation: avg glucose {sim.current_state.avg_glucose}→{sim.combined_projection.avg_glucose} mg/dL
          &nbsp;|&nbsp; spikes {sim.current_state.spike_count}→{sim.combined_projection.spike_count}
          &nbsp;|&nbsp; TIR {sim.current_state.tir}%→{sim.combined_projection.tir}%
        </div>
      </div>
    </div>
  )
}

// ─── Top 3 Actions (enhanced with confidence) ────────────────────────────────

function ActionCard({ action }) {
  const [showConfidence, setShowConfidence] = useState(false)
  const imp = action.impact_simulation

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex gap-4">
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-extrabold flex-shrink-0">
          {action.rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 mb-1">{action.action}</div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <DifficultyPill difficulty={action.difficulty} />
            {action.start_today && (
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                Start today
              </span>
            )}
            {action.confidence && <ConfidenceBadge confidence={action.confidence} />}
          </div>
          <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-3 py-2 mb-2">
            Expected: {action.expected_improvement}
          </div>

          {/* Mini impact stats */}
          {imp && (
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {imp.avg_glucose_delta !== 0 && (
                <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-slate-400 uppercase">Avg Glc</div>
                  <div className="text-xs font-bold text-emerald-600">{imp.avg_glucose_delta > 0 ? '+' : ''}{imp.avg_glucose_delta} mg/dL</div>
                </div>
              )}
              {imp.spike_count_delta !== 0 && (
                <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-slate-400 uppercase">Spikes</div>
                  <div className="text-xs font-bold text-emerald-600">{imp.spike_count_delta > 0 ? '+' : ''}{imp.spike_count_delta}</div>
                </div>
              )}
              {imp.overnight_sd_delta !== 0 && (
                <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-slate-400 uppercase">Night SD</div>
                  <div className="text-xs font-bold text-emerald-600">{imp.overnight_sd_delta > 0 ? '+' : ''}{imp.overnight_sd_delta} mg/dL</div>
                </div>
              )}
              {imp.tir_delta !== 0 && (
                <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                  <div className="text-[9px] text-slate-400 uppercase">TIR</div>
                  <div className="text-xs font-bold text-emerald-600">{imp.tir_delta > 0 ? '+' : ''}{imp.tir_delta}%</div>
                </div>
              )}
            </div>
          )}

          {/* Confidence detail toggle */}
          {action.confidence_basis && (
            <button
              className="text-[10px] text-slate-400 hover:text-slate-600 underline"
              onClick={() => setShowConfidence(v => !v)}
            >
              {showConfidence ? 'Hide confidence detail' : 'Why this confidence level?'}
            </button>
          )}
          {showConfidence && action.confidence_basis && (
            <div className="mt-2 text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2 italic">
              {action.confidence_basis}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Issues / Root Cause Panel ────────────────────────────────────────────────

function RootCauseCard({ issue }) {
  const [open, setOpen] = useState(false)
  const ev = issue.evidence

  return (
    <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <PriorityBadge priority={issue.priority} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 leading-tight">{issue.title}</div>
          {ev.worsened_by && <div className="text-xs text-rose-600 mt-0.5">{ev.worsened_by}</div>}
          {ev.key_insight && <div className="text-xs text-slate-500 mt-0.5">{ev.key_insight}</div>}
        </div>
        <span className="text-slate-300 text-xs flex-shrink-0 mt-0.5">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">
          {ev.phase_2 && ev.phase_3 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ev.phase_2).map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-lg p-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">{k.replace(/_/g, ' ')}</div>
                  <div className="flex items-end gap-2 mt-1">
                    <div>
                      <div className="text-[10px] text-slate-400">Phase 2</div>
                      <div className="text-sm font-bold text-slate-700">{String(v)}</div>
                    </div>
                    <div className="text-slate-300 text-xs">→</div>
                    <div>
                      <div className="text-[10px] text-slate-400">Phase 3</div>
                      <div className="text-sm font-bold text-rose-600">{String(ev.phase_3[k] ?? '—')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Root Causes</div>
            <div className="space-y-2">
              {issue.root_causes.map((rc, i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="text-xs font-bold text-slate-700">{rc.cause}</div>
                    <ConfidenceBadge confidence={rc.confidence} />
                  </div>
                  <div className="text-xs text-slate-600 mb-1">{rc.evidence}</div>
                  <div className="text-xs text-slate-400 italic">{rc.mechanism}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fixes</div>
            <div className="space-y-2">
              {issue.fixes.map((fix, i) => (
                <div key={i} className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="text-xs font-bold text-emerald-800">{fix.action}</div>
                    <DifficultyPill difficulty={fix.difficulty} />
                    {fix.confidence && <ConfidenceBadge confidence={fix.confidence} />}
                  </div>
                  <div className="text-xs text-emerald-700 font-semibold mb-1">
                    Expected: {fix.expected_impact}
                  </div>
                  <div className="text-xs text-slate-500 mb-0.5">Timeline: {fix.timeframe}</div>
                  <div className="text-xs text-slate-500 italic mb-1">{fix.evidence_base}</div>
                  {fix.confidence_basis && (
                    <div className="text-[10px] text-slate-400 leading-relaxed border-t border-emerald-100 pt-1 mt-1">
                      {fix.confidence_basis}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Phase Change Analysis ────────────────────────────────────────────────────

function PhaseChangePanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <span className="text-amber-600 font-bold text-sm">!</span>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classification</div>
          <div className="text-sm font-bold text-amber-700">{phaseChange.classification} Regression</div>
          <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{phaseChange.summary}</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What Changed</div>
        <div className="space-y-1.5">
          {phaseChange.changes.map((ch, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 bg-white">
              <div className="flex-1 text-xs font-medium text-slate-600 min-w-0">{ch.metric}</div>
              <div className="flex items-center gap-2 text-xs flex-shrink-0">
                <span className="text-slate-500">{ch.phase_2}</span>
                <span className="text-slate-300">→</span>
                <span className="text-rose-600 font-bold">{ch.phase_3}</span>
                <span className="text-rose-500 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">{ch.delta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Why It's Classified Behavioral</div>
        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{phaseChange.classification_reasoning}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
          <div className="text-xs font-bold text-amber-700 mb-2">Behavioral Factors</div>
          <ul className="space-y-1">
            {phaseChange.behavioral_factors.map((f, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="text-amber-400 flex-shrink-0 mt-0.5">•</span>{f}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
          <div className="text-xs font-bold text-blue-700 mb-2">Physiological Factors</div>
          <ul className="space-y-1">
            {phaseChange.physiological_factors.map((f, i) => (
              <li key={i} className="text-xs text-blue-800 flex items-start gap-1.5">
                <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>{f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
        <span className="text-emerald-600 text-lg flex-shrink-0">✓</span>
        <div className="text-xs font-semibold text-emerald-800">{phaseChange.outlook}</div>
      </div>
    </div>
  )
}

// ─── Personalised Rules ───────────────────────────────────────────────────────

function RulesPanel() {
  return (
    <div className="space-y-3">
      {rules.map((rule, i) => (
        <div key={rule.id} className="rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex items-start gap-3 mb-2">
            <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-600 text-[10px] font-bold">{i + 1}</span>
            </div>
            <div className="text-sm font-bold text-slate-800 leading-tight">{rule.rule}</div>
          </div>
          <div className="ml-9">
            <div className="text-xs text-slate-500 mb-2 italic leading-relaxed">{rule.data_basis}</div>
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
              <span className="text-xs font-semibold text-indigo-700">Action: </span>
              <span className="text-xs text-indigo-800">{rule.action}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Weekly targets ───────────────────────────────────────────────────────────

function WeeklyTargetsPanel() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {dash.weekly_targets.map(wt => (
        <div key={wt.week} className="rounded-xl bg-white border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">
              W{wt.week}
            </div>
            <div className="text-xs font-bold text-slate-700">{wt.focus}</div>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">{wt.target}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Expected Impact Tab ──────────────────────────────────────────────────────

// Horizontal comparison bar for one metric
function MetricComparisonRow({ metric }) {
  const { metric: label, unit, current, optimized, lower_is_better, improvement_pct } = metric
  const improved = lower_is_better ? optimized < current : optimized > current
  const maxVal = lower_is_better
    ? Math.max(current * 1.05, 1)
    : Math.max(optimized * 1.05, 1)

  const currentPct  = Math.min(100, (current / maxVal) * 100)
  const optimizedPct = Math.min(100, (optimized / maxVal) * 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">{label}</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">{current} {unit}</span>
          <span className="text-slate-300">→</span>
          <span className={`font-bold ${improved ? 'text-emerald-600' : 'text-rose-600'}`}>{optimized} {unit}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${improved ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {improved ? '↓' : '↑'} {improvement_pct}%
          </span>
        </div>
      </div>
      {/* Stacked bar */}
      <div className="relative h-2 bg-slate-100 rounded-full overflow-visible">
        {/* Current bar */}
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${currentPct}%`, backgroundColor: '#E2E8F0' }}
        />
        {/* Optimized bar — overlaid */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{
            width: `${optimizedPct}%`,
            backgroundColor: improved ? '#10B981' : '#EF4444',
            opacity: 0.7,
          }}
        />
        {/* Current marker line */}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-slate-400 rounded"
          style={{ left: `${currentPct}%` }}
        />
      </div>
    </div>
  )
}

// Current vs Optimized chart (grouped bars for score only)
function ScoreComparisonChart() {
  const chartData = [
    { name: 'Score', current: sim.current_state.score, optimized: sim.combined_projection.score },
    { name: 'TIR %', current: sim.current_state.tir, optimized: sim.combined_projection.tir },
  ]
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
          labelStyle={{ fontWeight: 700 }}
        />
        <Bar dataKey="current" name="Current" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
        <Bar dataKey="optimized" name="Optimized" fill="#10B981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Per-action contribution cards
function PerActionCards() {
  return (
    <div className="space-y-3">
      {sim.per_action.map(a => {
        const proj = a.projected
        return (
          <div key={a.action_rank} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                {a.action_rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 mb-1">{a.label}</div>
                <ConfidenceBadge confidence={a.confidence} />
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-slate-400">Projected score</div>
                <div className="text-base font-extrabold" style={{ color: scoreColor(proj.score).text }}>
                  {proj.score}
                </div>
              </div>
            </div>

            {/* Metric deltas */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { k: 'Avg Glc', v: a.deltas.avg_glucose, unit: 'mg/dL', lower: true },
                { k: 'Spikes', v: a.deltas.spike_count, unit: '', lower: true },
                { k: 'TIR', v: a.deltas.tir, unit: '%', lower: false },
                { k: 'CV', v: a.deltas.cv, unit: '%', lower: true },
                { k: 'Night SD', v: a.deltas.overnight_sd, unit: 'mg/dL', lower: true },
              ].filter(d => d.v !== 0).map(d => {
                const good = d.lower ? d.v < 0 : d.v > 0
                return (
                  <div key={d.k} className={`rounded-lg px-2 py-1.5 text-center ${good ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    <div className="text-[9px] text-slate-400 uppercase">{d.k}</div>
                    <div className={`text-xs font-bold ${good ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {d.v > 0 ? '+' : ''}{d.v}{d.unit}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="text-[10px] text-slate-400 italic leading-relaxed">{a.confidence_basis}</div>
          </div>
        )
      })}
    </div>
  )
}

// Feedback loop section
function FeedbackLoopSection() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 text-sm font-bold">
          ⟳
        </div>
        <div>
          <div className="text-xs font-bold text-indigo-800">Prediction record for Phase 4</div>
          <div className="text-xs text-indigo-600 mt-0.5">
            When your next CGM stint is uploaded, actual vs predicted values will be compared here to validate and refine the model.
          </div>
        </div>
      </div>

      {/* Predictions table */}
      <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="grid grid-cols-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            <span>Metric</span>
            <span className="text-center">Predicted</span>
            <span className="text-center">Actual</span>
            <span className="text-center">Accuracy</span>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {feedback.predictions.map(p => (
            <div key={p.metric} className="grid grid-cols-4 px-4 py-2.5 text-xs items-center">
              <span className="font-medium text-slate-700 capitalize">{p.metric.replace(/_/g, ' ')}</span>
              <span className="text-center font-bold text-indigo-600">{p.predicted} {p.unit}</span>
              <span className="text-center text-slate-300">—</span>
              <span className="text-center text-slate-300">—</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Conditions for predictions to hold</div>
        <ul className="space-y-1">
          {feedback.conditions.map((c, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
              <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>{c}
            </li>
          ))}
        </ul>
      </div>

      {/* Refinement rules */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Model refinement triggers</div>
        <div className="space-y-2">
          {feedback.refinement_rules.map((rule, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">If: {rule.trigger}</div>
              <div className="text-xs text-slate-700">→ {rule.action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Full Impact tab
function ImpactTab() {
  const [subTab, setSubTab] = useState('projection')

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { id: 'projection', label: 'Current vs Optimized' },
          { id: 'per_action', label: 'Per Action' },
          { id: 'feedback',   label: 'Feedback Loop' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 text-[10px] font-semibold py-1.5 px-2 rounded-lg transition-colors ${
              subTab === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'projection' && (
        <Card>
          <CardHeader
            title="Current vs Optimized"
            subtitle={`Applying all 3 actions together — avg glucose ${sim.current_state.avg_glucose}→${sim.combined_projection.avg_glucose} mg/dL, score ${sim.current_state.score}→${sim.combined_projection.score}`}
          />
          <div className="mt-4 space-y-4">
            {/* Score & TIR bar chart */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Score &amp; TIR</div>
              <ScoreComparisonChart />
              <div className="flex items-center gap-4 justify-center mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-slate-300" />
                  <span className="text-[10px] text-slate-500">Current</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-[10px] text-slate-500">Optimized</span>
                </div>
              </div>
            </div>

            {/* All metric rows */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">All Metrics</div>
              {sim.chart_data.map(m => (
                <MetricComparisonRow key={m.metric} metric={m} />
              ))}
            </div>

            {/* Simulation notes */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Simulation notes</div>
              <ul className="space-y-1">
                {sim.simulation_notes.map((n, i) => (
                  <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                    <span className="text-slate-300 flex-shrink-0 mt-0.5">·</span>{n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {subTab === 'per_action' && (
        <Card>
          <CardHeader
            title="Individual Action Impact"
            subtitle="What each action achieves in isolation — combine all 3 for full effect"
          />
          <div className="mt-4">
            <PerActionCards />
          </div>
        </Card>
      )}

      {subTab === 'feedback' && (
        <Card>
          <CardHeader
            title="Feedback Loop"
            subtitle="Predictions for Phase 4 — fill in actuals to validate the model"
          />
          <div className="mt-4">
            <FeedbackLoopSection />
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'actions', label: 'Action Plan' },
  { id: 'impact',  label: 'Expected Impact' },
  { id: 'issues',  label: 'Root Causes' },
  { id: 'phase',   label: 'Phase Change' },
  { id: 'rules',   label: 'Your Rules' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FixYourGlucose() {
  const [activeTab, setActiveTab] = useState('actions')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fix Your Glucose</h1>
          <p className="text-sm text-slate-500 mt-1">
            Data-derived recommendations from {analytics.datasets.phase_2.summary.spike_count + analytics.datasets.phase_3.summary.spike_count} spikes
            across two CGM phases — with impact simulations, confidence scores, and Phase 4 predictions.
          </p>
        </div>

        {/* Score recovery banner */}
        <ScoreRecoveryBanner />

        {/* Tab bar — scrollable on mobile */}
        <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 text-[11px] font-semibold py-2 px-3 rounded-lg transition-colors ${
                activeTab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Top 3 Problems" subtitle="Ranked by impact on your metabolic score" />
              <div className="space-y-2 mt-4">
                {dash.top3_problems.map(p => (
                  <div key={p.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 bg-slate-50">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                      {p.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800">{p.title}</span>
                        <PriorityBadge priority={p.priority} />
                      </div>
                      {p.one_liner && <div className="text-xs text-slate-500 mt-0.5">{p.one_liner}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Top 3 Actions" subtitle="Each includes impact simulation and confidence score" />
              <div className="space-y-3 mt-4">
                {dash.top3_actions.map(a => <ActionCard key={a.rank} action={a} />)}
              </div>
            </Card>

            <Card>
              <CardHeader title="2-Week Game Plan" subtitle="Week-by-week focus areas" />
              <div className="mt-4">
                <WeeklyTargetsPanel />
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'impact' && <ImpactTab />}

        {activeTab === 'issues' && (
          <Card>
            <CardHeader
              title="Issue Analysis"
              subtitle="Tap each issue to see root causes, confidence-scored evidence, and targeted fixes"
            />
            <div className="space-y-3 mt-4">
              {issues.map(issue => <RootCauseCard key={issue.id} issue={issue} />)}
            </div>
          </Card>
        )}

        {activeTab === 'phase' && (
          <Card>
            <CardHeader
              title="Phase 2 → Phase 3: What Happened"
              subtitle="Why your glucose worsened and what drove it"
            />
            <div className="mt-4">
              <PhaseChangePanel />
            </div>
          </Card>
        )}

        {activeTab === 'rules' && (
          <Card>
            <CardHeader
              title="Your Personalised Rules"
              subtitle="Data-derived rules specific to your glucose patterns"
            />
            <div className="mt-4">
              <RulesPanel />
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}
