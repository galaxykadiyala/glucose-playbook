#!/usr/bin/env node
/**
 * generateAnalytics.cjs
 * Processes the parsed Ultrahuman stint JSON files and produces a
 * comprehensive, chart-ready analytics output for UI consumption.
 *
 * Inputs:  src/data/stint_2.json  (phase_2)
 *          src/data/stint_3.json  (phase_3)
 * Output:  src/data/fullAnalytics.json
 */

const fs   = require('fs')
const path = require('path')

// ─── Load data ────────────────────────────────────────────────────────────────

const PHASE_2 = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/stint_2.json'), 'utf8'))
const PHASE_3 = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/stint_3.json'), 'utf8'))

const PHASES = [
  { id: 'phase_2', label: 'Stint 2', dateLabel: 'Feb 28 – Mar 15, 2026', data: PHASE_2 },
  { id: 'phase_3', label: 'Stint 3', dateLabel: 'Mar 15 – Mar 30, 2026', data: PHASE_3 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0
const sd  = arr => {
  if (!arr.length) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.round(Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length) * 10) / 10
}

function classify(value, lowerBetter = true) {
  // Returns a direction flag: 'improved', 'worsened', 'neutral'
  if (Math.abs(value) < 1) return 'neutral'
  return lowerBetter ? (value < 0 ? 'improved' : 'worsened') : (value > 0 ? 'improved' : 'worsened')
}

function formatChange(value, unit = '', lowerBetter = true) {
  const rounded = Math.round(value * 10) / 10
  const dir     = classify(rounded, lowerBetter)
  const sign    = rounded > 0 ? '+' : ''
  return { raw: rounded, formatted: `${sign}${rounded}${unit}`, direction: dir }
}

// ─── 1. Verify & summarise each phase ────────────────────────────────────────

function buildPhaseSummary(phase) {
  const { id, label, dateLabel, data } = phase
  const { readings, daily_summaries, spikes, overall, time_of_day, metadata } = data

  // ── Verification block ──
  const verification = {
    phase_id:        id,
    label,
    date_range:      { start: metadata.date_range.start, end: metadata.date_range.end },
    total_readings:  readings.length,
    total_days:      daily_summaries.length,
    interval_min:    metadata.interval_min,
    total_spikes:    spikes.length,
    sample_readings: [readings[0], readings[Math.floor(readings.length / 2)], readings[readings.length - 1]],
  }

  // ── Summary ──
  const summary = {
    avg_glucose:   overall.stats.avg,
    max_glucose:   overall.stats.max,
    min_glucose:   overall.stats.min,
    variability:   { sd: overall.stats.sd, cv: overall.stats.cv },
    time_in_range: overall.tir,
    spike_count:   spikes.length,
    avg_score:     overall.avg_score,
  }

  // ── Daily summaries (clean, chart-ready) ──
  const daily = daily_summaries.map(d => ({
    date:         d.date,
    avg_glucose:  d.stats.avg,
    max_glucose:  d.stats.max,
    min_glucose:  d.stats.min,
    sd:           d.stats.sd,
    tir_inRange:  d.tir.inRange,
    tir_elevated: d.tir.elevated,
    tir_high:     d.tir.high,
    spike_count:  d.spikeCount,
    score:        d.score,
    insight:      d.insight,
  }))

  // ── Overnight analysis (one entry per day) ──
  const overnight_analysis = daily_summaries
    .filter(d => d.overnight)
    .map(d => ({
      date:             d.date,
      avg_overnight:    d.overnight.stats.avg,
      min_overnight:    d.overnight.stats.min,
      max_overnight:    d.overnight.stats.max,
      variability_sd:   d.overnight.stats.sd,
      stability_score:  d.overnight.stats.sd <= 8 ? 'stable' : d.overnight.stats.sd <= 15 ? 'moderate' : 'unstable',
      dawn_phenomenon:  d.overnight.hasDawn,
      insight:          d.overnight.insight,
    }))

  // ── Spikes (full list with context) ──
  const spike_list = spikes.map(s => ({
    date:             s.date,
    start:            s.startTimestamp,
    peak:             s.peakTimestamp,
    baseline:         s.baselineGlucose,
    peak_glucose:     s.peakGlucose,
    rise:             s.rise,
    duration_min:     s.durationMin,
    time_of_day:      s.timeOfDay,
  }))

  // ── Best / worst days ──
  const sortedByScore  = [...daily_summaries].sort((a, b) => b.score - a.score)
  const sortedByGlucose = [...daily_summaries].sort((a, b) => a.stats.avg - b.stats.avg)

  const best_days  = sortedByScore.slice(0, 3).map(d => ({
    date: d.date, score: d.score, avg: d.stats.avg, insight: d.insight,
  }))
  const worst_days = sortedByScore.slice(-3).reverse().map(d => ({
    date: d.date, score: d.score, avg: d.stats.avg, insight: d.insight,
  }))

  // ── Time-of-day breakdown ──
  const tod_breakdown = Object.entries(time_of_day.windows).map(([key, w]) => ({
    period:       key,
    label:        w.label,
    range:        w.range,
    avg_glucose:  w.avg,
    max_glucose:  w.max,
    sd:           w.sd,
    spike_count:  w.spikeCount,
    spike_share:  pct(w.spikeCount, spikes.length),
  })).sort((a, b) => (b.avg_glucose ?? 0) - (a.avg_glucose ?? 0))

  const worst_period = time_of_day.worstWindow
  const best_period  = time_of_day.bestWindow

  // ── Overnight stability summary ──
  const overnightSDs   = overnight_analysis.map(o => o.variability_sd)
  const dawnCount      = overnight_analysis.filter(o => o.dawn_phenomenon).length
  const unstableNights = overnight_analysis.filter(o => o.stability_score === 'unstable').length
  const stableNights   = overnight_analysis.filter(o => o.stability_score === 'stable').length

  const overnight_summary = {
    avg_overnight_glucose: avg(overnight_analysis.map(o => o.avg_overnight)),
    avg_overnight_sd:      Math.round(avg(overnightSDs) * 10) / 10,
    stable_nights:         stableNights,
    unstable_nights:       unstableNights,
    dawn_phenomenon_count: dawnCount,
    dawn_pct:              pct(dawnCount, overnight_analysis.length),
  }

  // ── Spike distribution ──
  const spikeTOD = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const s of spikes) spikeTOD[s.timeOfDay] = (spikeTOD[s.timeOfDay] || 0) + 1

  const spikeRises = spikes.map(s => s.rise)
  const spike_distribution = {
    by_time_of_day:   spikeTOD,
    avg_rise:         avg(spikeRises),
    max_rise:         spikeRises.length ? Math.max(...spikeRises) : 0,
    avg_duration_min: avg(spikes.map(s => s.durationMin)),
    worst_spike:      spikes.length
      ? spikes.reduce((a, b) => b.peakGlucose > a.peakGlucose ? b : a)
      : null,
  }

  // ── Chart-ready data structures ──
  const chart_data = {
    // Timeline: all readings (for full continuous glucose chart)
    glucose_timeline: readings.map(r => ({
      t: r.timestamp,
      g: r.glucose,
    })),

    // Daily averages (for bar/line chart per day)
    daily_averages: daily.map(d => ({
      date:  d.date,
      avg:   d.avg_glucose,
      max:   d.max_glucose,
      score: d.score,
      spikes: d.spike_count,
    })),

    // Overnight per night
    overnight_graph: overnight_analysis.map(o => ({
      date:  o.date,
      avg:   o.avg_overnight,
      sd:    o.variability_sd,
      dawn:  o.dawn_phenomenon,
    })),

    // Spike count by date (for spike frequency chart)
    spike_by_date: (() => {
      const map = {}
      for (const s of spikes) map[s.date] = (map[s.date] || 0) + 1
      return Object.entries(map).map(([date, count]) => ({ date, count }))
    })(),

    // Time-of-day avg glucose (for heatmap/bar chart)
    tod_avg: tod_breakdown.map(t => ({
      period: t.label,
      avg:    t.avg_glucose,
      spikes: t.spike_count,
    })),

    // Score trend
    score_trend: daily.map(d => ({ date: d.date, score: d.score })),
  }

  // ── Text insights ──
  const weekAvg = (group) => avg(group.map(d => d.stats.avg))
  const w1 = daily_summaries.slice(0, 7)
  const w2 = daily_summaries.slice(7)
  const weekTrend = weekAvg(w2) - weekAvg(w1)

  const text_insights = []

  if (overall.tir.inRange >= 85)
    text_insights.push({ type: 'success', text: `Strong time-in-range: ${overall.tir.inRange}% of readings between 70–140 mg/dL` })
  else if (overall.tir.inRange < 70)
    text_insights.push({ type: 'danger', text: `Low time-in-range: ${overall.tir.inRange}% — significant portion of day above 140 mg/dL` })
  else
    text_insights.push({ type: 'warning', text: `Time-in-range is ${overall.tir.inRange}% — room for improvement toward 85%+` })

  text_insights.push({ type: 'info', text: `Most challenging time window: ${worst_period} (avg ${time_of_day.windows[worst_period].avg} mg/dL, ${spikeTOD[worst_period]} spikes)` })
  text_insights.push({ type: 'info', text: `Best-controlled window: ${best_period} (avg ${time_of_day.windows[best_period].avg} mg/dL)` })

  if (dawnCount > daily_summaries.length * 0.3)
    text_insights.push({ type: 'warning', text: `Dawn phenomenon detected on ${dawnCount} of ${daily_summaries.length} days (${pct(dawnCount, daily_summaries.length)}%) — early morning glucose rise is a consistent pattern` })
  else
    text_insights.push({ type: 'success', text: `Dawn phenomenon occurred on only ${dawnCount} of ${daily_summaries.length} days — overnight pattern is mostly stable` })

  if (weekTrend > 5)
    text_insights.push({ type: 'warning', text: `Intra-stint trend: glucose averaged ${weekTrend} mg/dL higher in week 2 vs week 1 — metabolic control degraded over time` })
  else if (weekTrend < -5)
    text_insights.push({ type: 'success', text: `Intra-stint trend: glucose improved by ${Math.abs(weekTrend)} mg/dL from week 1 to week 2` })
  else
    text_insights.push({ type: 'info', text: `Glucose was stable across both weeks of the stint (week 2 avg within ${Math.abs(weekTrend)} mg/dL of week 1)` })

  if (overall.stats.cv > 25)
    text_insights.push({ type: 'danger', text: `High glucose variability (CV ${overall.stats.cv}%) — erratic patterns throughout the day. Target CV <23% for metabolic health` })
  else
    text_insights.push({ type: 'success', text: `Glucose variability is within healthy range (CV ${overall.stats.cv}%)` })

  text_insights.push({ type: 'info', text: `${spikes.length} glucose spikes detected across ${daily_summaries.length} days (avg ${Math.round(spikes.length / daily_summaries.length * 10) / 10} spikes/day)` })

  return {
    verification,
    summary,
    daily_summaries: daily,
    overnight_analysis,
    overnight_summary,
    spike_list,
    spike_distribution,
    tod_breakdown,
    best_days,
    worst_days,
    chart_data,
    text_insights,
  }
}

// ─── 2. Compare phases ────────────────────────────────────────────────────────

function buildComparison(p2Result, p3Result) {
  const a = p2Result.summary
  const b = p3Result.summary

  const avgChange  = b.avg_glucose - a.avg_glucose
  const sdChange   = b.variability.sd - a.variability.sd
  const cvChange   = b.variability.cv - a.variability.cv
  const tirChange  = b.time_in_range.inRange - a.time_in_range.inRange
  const spikeChange = b.spike_count - a.spike_count
  const scoreChange = b.avg_score - a.avg_score

  const changes = {
    avg_glucose:   formatChange(avgChange,  ' mg/dL', true),
    variability_sd: formatChange(sdChange,  '',       true),
    variability_cv: formatChange(cvChange,  '%',      true),
    spike_count:   formatChange(spikeChange, '',      true),
    tir_inRange:   formatChange(tirChange,  '%',      false),
    avg_score:     formatChange(scoreChange, '',      false),
  }

  // Overnight stability change
  const oN2 = p2Result.overnight_summary
  const oN3 = p3Result.overnight_summary
  const overnightAvgChange = oN3.avg_overnight_glucose - oN2.avg_overnight_glucose
  const overnightSdChange  = oN3.avg_overnight_sd - oN2.avg_overnight_sd
  changes.overnight_avg_glucose = formatChange(overnightAvgChange, ' mg/dL', true)
  changes.overnight_sd          = formatChange(overnightSdChange,  '',       true)

  // Worst/best period shift
  const tod2Worst = p2Result.tod_breakdown.find(t => t.period === PHASE_2.time_of_day.worstWindow)
  const tod3Worst = p3Result.tod_breakdown.find(t => t.period === PHASE_3.time_of_day.worstWindow)

  // Overall verdict
  const positiveChanges  = Object.values(changes).filter(c => c.direction === 'improved').length
  const negativeChanges  = Object.values(changes).filter(c => c.direction === 'worsened').length
  const overallDirection = positiveChanges >= negativeChanges ? 'improved' : 'worsened'

  // Structured text insights
  const comparison_insights = []

  if (avgChange > 0)
    comparison_insights.push({ type: 'danger',  metric: 'Average Glucose',   text: `Average glucose increased by ${avgChange} mg/dL in Stint 3 (${a.avg_glucose} → ${b.avg_glucose} mg/dL)` })
  else
    comparison_insights.push({ type: 'success', metric: 'Average Glucose',   text: `Average glucose improved by ${Math.abs(avgChange)} mg/dL in Stint 3 (${a.avg_glucose} → ${b.avg_glucose} mg/dL)` })

  if (cvChange > 0)
    comparison_insights.push({ type: 'danger',  metric: 'Variability',       text: `Glucose variability increased in Stint 3 (CV: ${a.variability.cv}% → ${b.variability.cv}%) — less predictable patterns` })
  else
    comparison_insights.push({ type: 'success', metric: 'Variability',       text: `Glucose variability reduced in Stint 3 (CV: ${a.variability.cv}% → ${b.variability.cv}%)` })

  if (spikeChange > 0)
    comparison_insights.push({ type: 'danger',  metric: 'Spike Frequency',   text: `Spike frequency increased by ${spikeChange} events in Stint 3 (${a.spike_count} → ${b.spike_count} spikes)` })
  else
    comparison_insights.push({ type: 'success', metric: 'Spike Frequency',   text: `Spike frequency reduced by ${Math.abs(spikeChange)} events in Stint 3` })

  if (tirChange < 0)
    comparison_insights.push({ type: 'danger',  metric: 'Time in Range',     text: `Time-in-range dropped by ${Math.abs(tirChange)}% in Stint 3 (${a.time_in_range.inRange}% → ${b.time_in_range.inRange}%)` })
  else
    comparison_insights.push({ type: 'success', metric: 'Time in Range',     text: `Time-in-range improved by ${tirChange}% in Stint 3` })

  if (overnightAvgChange > 0)
    comparison_insights.push({ type: 'warning', metric: 'Overnight Glucose', text: `Overnight glucose rose by ${overnightAvgChange} mg/dL in Stint 3 (${oN2.avg_overnight_glucose} → ${oN3.avg_overnight_glucose} mg/dL)` })
  else
    comparison_insights.push({ type: 'success', metric: 'Overnight Glucose', text: `Overnight glucose improved by ${Math.abs(overnightAvgChange)} mg/dL in Stint 3` })

  comparison_insights.push({
    type: PHASE_2.time_of_day.worstWindow === PHASE_3.time_of_day.worstWindow ? 'warning' : 'info',
    metric: 'Most Unstable Period',
    text: PHASE_2.time_of_day.worstWindow === PHASE_3.time_of_day.worstWindow
      ? `Morning remains the most challenging period in both stints (avg ${tod2Worst?.avg_glucose} → ${tod3Worst?.avg_glucose} mg/dL)`
      : `Worst period shifted from ${PHASE_2.time_of_day.worstWindow} (Stint 2) to ${PHASE_3.time_of_day.worstWindow} (Stint 3)`,
  })

  // Spike rise magnitude comparison
  const avgRise2 = p2Result.spike_distribution.avg_rise
  const avgRise3 = p3Result.spike_distribution.avg_rise
  if (avgRise3 > avgRise2 + 2)
    comparison_insights.push({ type: 'danger', metric: 'Spike Severity', text: `Average spike magnitude increased in Stint 3 (avg rise: ${avgRise2} → ${avgRise3} mg/dL) — spikes are both more frequent and sharper` })
  else
    comparison_insights.push({ type: 'info', metric: 'Spike Severity', text: `Average spike rise stayed similar (${avgRise2} → ${avgRise3} mg/dL) despite more frequent spikes in Stint 3` })

  comparison_insights.push({
    type: overallDirection === 'improved' ? 'success' : 'danger',
    metric: 'Overall Verdict',
    text: overallDirection === 'improved'
      ? `Metabolic health improved from Stint 2 to Stint 3 — score: ${a.avg_score} → ${b.avg_score}`
      : `Metabolic health regressed from Stint 2 to Stint 3 — score: ${a.avg_score} → ${b.avg_score} (−${a.avg_score - b.avg_score} points)`,
  })

  return {
    phase_2_label: 'Stint 2 (Feb 28 – Mar 15)',
    phase_3_label: 'Stint 3 (Mar 15 – Mar 30)',
    phase_2_summary: a,
    phase_3_summary: b,
    changes,
    overall_direction: overallDirection,
    comparison_insights,
    overnight_comparison: {
      phase_2: oN2,
      phase_3: oN3,
    },
    // Chart-ready: side by side avg per period
    tod_comparison: ['morning', 'afternoon', 'evening', 'night'].map(key => ({
      period:   key.charAt(0).toUpperCase() + key.slice(1),
      phase_2:  PHASE_2.time_of_day.windows[key]?.avg ?? 0,
      phase_3:  PHASE_3.time_of_day.windows[key]?.avg ?? 0,
      spikes_2: PHASE_2.time_of_day.windows[key]?.spikeCount ?? 0,
      spikes_3: PHASE_3.time_of_day.windows[key]?.spikeCount ?? 0,
    })),
    // Chart-ready: score trend for both phases aligned by day-index
    score_comparison: (() => {
      const d2 = PHASE_2.daily_summaries
      const d3 = PHASE_3.daily_summaries
      const len = Math.max(d2.length, d3.length)
      return Array.from({ length: len }, (_, i) => ({
        day:      i + 1,
        phase_2:  d2[i]?.score ?? null,
        phase_3:  d3[i]?.score ?? null,
      }))
    })(),
  }
}

// ─── 3. Run and write ─────────────────────────────────────────────────────────

console.log('Generating full analytics...\n')

const p2Result = buildPhaseSummary(PHASES[0])
const p3Result = buildPhaseSummary(PHASES[1])
const comparison = buildComparison(p2Result, p3Result)

const output = {
  generated_at: new Date().toISOString(),
  datasets: {
    phase_2: { id: 'phase_2', label: 'Stint 2', date_label: 'Feb 28 – Mar 15, 2026', ...p2Result },
    phase_3: { id: 'phase_3', label: 'Stint 3', date_label: 'Mar 15 – Mar 30, 2026', ...p3Result },
  },
  comparison,
}

const outPath = path.join(__dirname, '../src/data/fullAnalytics.json')
fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2)
console.log(`Written → src/data/fullAnalytics.json (${sizeMB} MB)\n`)

// ─── Print verification ───────────────────────────────────────────────────────

for (const [phaseId, phase] of Object.entries(output.datasets)) {
  const v = phase.verification
  const s = phase.summary
  console.log(`══ ${phase.label} (${phase.date_label}) ══`)
  console.log(`  Records:    ${v.total_readings} readings (${v.interval_min}-min intervals)`)
  console.log(`  Days:       ${v.total_days}`)
  console.log(`  Date range: ${v.date_range.start} → ${v.date_range.end}`)
  console.log(`  Sample:     [${v.sample_readings.map(r => `${r.timestamp.slice(11,16)} → ${r.glucose}`).join(' | ')}]`)
  console.log()
  console.log(`  Summary:`)
  console.log(`    avg glucose:  ${s.avg_glucose} mg/dL`)
  console.log(`    max glucose:  ${s.max_glucose} mg/dL`)
  console.log(`    min glucose:  ${s.min_glucose} mg/dL`)
  console.log(`    variability:  SD ${s.variability.sd} | CV ${s.variability.cv}%`)
  console.log(`    TIR:          ${s.time_in_range.inRange}% in-range | ${s.time_in_range.elevated}% elevated | ${s.time_in_range.high}% high`)
  console.log(`    spike count:  ${s.spike_count}`)
  console.log(`    avg score:    ${s.avg_score}/100`)
  console.log()
  console.log(`  Best days:  ${phase.best_days.map(d => `${d.date} (score ${d.score})`).join(' | ')}`)
  console.log(`  Worst days: ${phase.worst_days.map(d => `${d.date} (score ${d.score})`).join(' | ')}`)
  console.log()
  console.log(`  Overnight:  avg ${phase.overnight_summary.avg_overnight_glucose} mg/dL | ${phase.overnight_summary.stable_nights} stable nights | ${phase.overnight_summary.dawn_phenomenon_count} dawn events`)
  console.log()
  console.log(`  TOD (avg mg/dL):`)
  for (const t of phase.tod_breakdown) {
    const marker = t.period === (phaseId === 'phase_2' ? PHASE_2 : PHASE_3).time_of_day.worstWindow ? ' ← WORST' : ''
    const marker2 = t.period === (phaseId === 'phase_2' ? PHASE_2 : PHASE_3).time_of_day.bestWindow ? ' ← BEST' : ''
    console.log(`    ${t.label.padEnd(12)} ${t.avg_glucose ?? 'n/a'} mg/dL  (${t.spike_count} spikes, ${t.spike_share}% of total)${marker}${marker2}`)
  }
  console.log()
  console.log(`  Text insights:`)
  for (const ins of phase.text_insights) {
    const icon = ins.type === 'success' ? '✓' : ins.type === 'danger' ? '✗' : ins.type === 'warning' ? '⚠' : 'ℹ'
    console.log(`    ${icon} ${ins.text}`)
  }
  console.log()
}

// ─── Comparison output ────────────────────────────────────────────────────────

console.log('══ PHASE COMPARISON: Stint 2 → Stint 3 ══')
console.log()

const changes = comparison.changes
console.log('  Metric comparison:')
for (const [key, c] of Object.entries(changes)) {
  const arrow = c.direction === 'improved' ? '↑' : c.direction === 'worsened' ? '↓' : '→'
  console.log(`    ${key.replace(/_/g,' ').padEnd(22)} ${c.formatted.padStart(8)}  ${arrow} ${c.direction}`)
}

console.log()
console.log(`  Overall verdict: ${comparison.overall_direction.toUpperCase()}`)
console.log()
console.log('  Comparison insights:')
for (const ins of comparison.comparison_insights) {
  const icon = ins.type === 'success' ? '✓' : ins.type === 'danger' ? '✗' : ins.type === 'warning' ? '⚠' : 'ℹ'
  console.log(`    ${icon} [${ins.metric}] ${ins.text}`)
}
