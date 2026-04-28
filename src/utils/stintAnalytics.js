import { calculateTIR, calculateStats, estimateA1C, countSpikes } from './glucoseUtils'

// All functions take readings: [{ timestamp, glucose_value, event_label }]

function scoreFromMetrics({ tir_inRange, avg_glucose, sd, spike_count }) {
  const tirScore   = tir_inRange * 0.4
  const avgScore   = Math.max(0, 25 - Math.max(0, avg_glucose - 100) * 0.5)
  const varScore   = Math.max(0, 20 - Math.max(0, sd - 10) * 0.8)
  const spikeScore = Math.max(0, 15 - spike_count * 2)
  return Math.min(100, Math.round(tirScore + avgScore + varScore + spikeScore))
}

export function computeMetadata(readings) {
  const numeric = readings.filter(r => r.glucose_value != null)
  if (!numeric.length) return null
  const dates = [...new Set(numeric.map(r => r.timestamp.slice(0, 10)))].sort()
  return {
    total_readings: numeric.length,
    days: dates.length,
    start_date: dates[0],
    end_date: dates[dates.length - 1],
  }
}

export function computeHourlyAverages(readings) {
  const numeric = readings.filter(r => r.glucose_value != null)
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, values: [] }))
  for (const r of numeric) {
    buckets[new Date(r.timestamp).getHours()].values.push(r.glucose_value)
  }
  return buckets.map(b => ({
    hour: b.hour,
    avg: b.values.length
      ? Math.round(b.values.reduce((a, c) => a + c, 0) / b.values.length)
      : null,
  }))
}

// Returns weeklyData compatible with Patterns.jsx:
// readings[] is an array of plain numbers (glucoseUtils accepts typeof number)
export function computeWeeklyData(readings) {
  const numeric = readings.filter(r => r.glucose_value != null)
  const byDate = {}
  for (const r of numeric) {
    const d = r.timestamp.slice(0, 10)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r.glucose_value)
  }
  const dates = Object.keys(byDate).sort()
  const weeks = []
  for (let i = 0; i < dates.length; i += 7) {
    const chunk = dates.slice(i, i + 7)
    const vals  = chunk.flatMap(d => byDate[d])
    const tir   = calculateTIR(vals)
    const stats = calculateStats(vals)
    weeks.push({
      label:        `Week ${Math.floor(i / 7) + 1}`,
      readings:     vals,
      timeInRange:  tir.inRange,
      timeElevated: tir.elevated,
      timeHigh:     tir.high,
      avgGlucose:   stats.avg,
      minGlucose:   stats.min,
      maxGlucose:   stats.max,
      estimatedA1c: estimateA1C(stats.avg),
    })
  }
  return weeks
}

export function computeDailySummaries(readings) {
  const numeric = readings.filter(r => r.glucose_value != null)
  const byDate = {}
  for (const r of numeric) {
    const d = r.timestamp.slice(0, 10)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r.glucose_value)
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => {
      const tir    = calculateTIR(vals)
      const stats  = calculateStats(vals)
      const spikes = countSpikes(vals)
      const score  = scoreFromMetrics({ tir_inRange: tir.inRange, avg_glucose: stats.avg, sd: stats.stdDev, spike_count: spikes })
      return {
        date,
        score,
        tir_inRange:  tir.inRange,
        tir_elevated: tir.elevated,
        tir_high:     tir.high,
        tir_low:      tir.low,
        avg_glucose:  stats.avg,
        max_glucose:  stats.max,
        sd:           stats.stdDev,
        spike_count:  spikes,
        insight: score >= 80 ? 'Excellent glucose control'
               : score >= 65 ? 'Good glucose management'
               : score >= 50 ? 'Moderate control — room to improve'
               : 'Challenging day — review meals and activity',
      }
    })
}

export function computeOvernightAnalysis(readings) {
  const numeric = readings.filter(r => r.glucose_value != null)
  const byMorning = {}
  for (const r of numeric) {
    const ts = new Date(r.timestamp)
    const h  = ts.getHours()
    if (h < 7 || h >= 22) {
      // group overnight hour under the morning (wake-up) date
      const d = h < 7
        ? r.timestamp.slice(0, 10)
        : new Date(ts.getTime() + 86400000).toISOString().slice(0, 10)
      if (!byMorning[d]) byMorning[d] = []
      byMorning[d].push(r.glucose_value)
    }
  }
  return Object.entries(byMorning)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => {
      const stats = calculateStats(vals)
      const dawn  = vals.length > 4 && vals[vals.length - 1] - vals[0] > 15
      return {
        date,
        avg_overnight:   stats.avg,
        min_overnight:   stats.min,
        max_overnight:   stats.max,
        variability_sd:  stats.stdDev,
        dawn_phenomenon: dawn,
        insight: dawn           ? 'Dawn phenomenon detected — early morning glucose rise'
               : stats.avg < 100 ? 'Stable overnight — excellent'
               : stats.avg < 120  ? 'Slightly elevated overnight'
               : 'Elevated overnight glucose — review evening meals',
      }
    })
}

export function computeTODBreakdown(readings) {
  const numeric = readings.filter(r => r.glucose_value != null)
  const periods = [
    { key: 'morning',   label: 'Morning',   hours: [6,7,8,9,10,11] },
    { key: 'afternoon', label: 'Afternoon', hours: [12,13,14,15,16] },
    { key: 'evening',   label: 'Evening',   hours: [17,18,19,20,21] },
    { key: 'overnight', label: 'Overnight', hours: [22,23,0,1,2,3,4,5] },
  ]
  return periods.map(p => {
    const vals = numeric
      .filter(r => p.hours.includes(new Date(r.timestamp).getHours()))
      .map(r => r.glucose_value)
    if (!vals.length) return { period: p.key, label: p.label, avg_glucose: 0, spike_count: 0, spike_share: 0 }
    const avg    = Math.round(vals.reduce((a, c) => a + c, 0) / vals.length)
    const spikes = vals.filter(v => v > 140).length
    return {
      period:      p.key,
      label:       p.label,
      avg_glucose: avg,
      spike_count: spikes,
      spike_share: Math.round((spikes / vals.length) * 100),
    }
  })
}

export function computeSpikeList(readings) {
  const numeric = readings
    .filter(r => r.glucose_value != null)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const spikes = []
  let inSpike  = false
  let peakVal  = 0
  let peakTs   = null
  let peakTOD  = 'night'

  for (const r of numeric) {
    const h   = new Date(r.timestamp).getHours()
    const tod = h >= 6 && h < 12 ? 'morning'
              : h >= 12 && h < 17 ? 'afternoon'
              : h >= 17 && h < 22 ? 'evening' : 'night'

    if (r.glucose_value > 140) {
      if (!inSpike) { inSpike = true; peakVal = r.glucose_value; peakTs = r.timestamp; peakTOD = tod }
      else if (r.glucose_value > peakVal) { peakVal = r.glucose_value; peakTs = r.timestamp; peakTOD = tod }
    } else if (inSpike) {
      spikes.push({ time_of_day: peakTOD, peak_glucose: peakVal, rise: Math.max(0, peakVal - 100), date: peakTs.slice(0, 10) })
      inSpike = false; peakVal = 0; peakTs = null
    }
  }
  return spikes
}

export function computeOvernightSummary(overnightAnalysis) {
  if (!overnightAnalysis.length) return { avg_overnight_glucose: 0, avg_overnight_sd: 0, stable_nights: 0, unstable_nights: 0, dawn_phenomenon_count: 0, dawn_pct: 0 }
  const avgs        = overnightAnalysis.map(n => n.avg_overnight)
  const sds         = overnightAnalysis.map(n => n.variability_sd)
  const dawnCount   = overnightAnalysis.filter(n => n.dawn_phenomenon).length
  const stableCount = overnightAnalysis.filter(n => n.avg_overnight < 110 && n.variability_sd < 15).length
  const total       = overnightAnalysis.length
  return {
    avg_overnight_glucose: Math.round(avgs.reduce((a, c) => a + c, 0) / avgs.length),
    avg_overnight_sd:      Math.round(sds.reduce((a, c) => a + c, 0) / sds.length),
    stable_nights:         stableCount,
    unstable_nights:       total - stableCount,
    dawn_phenomenon_count: dawnCount,
    dawn_pct:              Math.round((dawnCount / total) * 100),
  }
}

export function computeBestWorstDays(dailySummaries, n = 3) {
  const sorted  = [...dailySummaries].sort((a, b) => b.score - a.score)
  const addAvg  = d => ({ ...d, avg: d.avg_glucose })
  return {
    best_days:  sorted.slice(0, n).map(addAvg),
    worst_days: sorted.slice(-n).reverse().map(addAvg),
  }
}

export function computeTextInsights(dailySummaries, todBreakdown, overnightSummary) {
  const n        = dailySummaries.length
  const avgTIR   = Math.round(dailySummaries.reduce((a, d) => a + d.tir_inRange, 0) / n)
  const total    = dailySummaries.reduce((a, d) => a + d.spike_count, 0)
  const daily    = (total / n).toFixed(1)
  const worstTOD = todBreakdown.reduce((a, b) => b.avg_glucose > a.avg_glucose ? b : a)

  const out = []
  out.push(avgTIR >= 70
    ? { type: 'success', text: `Time in range averaged ${avgTIR}% — above the recommended 70% target.` }
    : { type: 'warning', text: `Time in range averaged ${avgTIR}% — below the 70% target. Focus on post-meal control.` })

  out.push({ type: 'info', text: `${worstTOD.label} had the highest avg glucose at ${worstTOD.avg_glucose} mg/dL with ${worstTOD.spike_share}% of readings elevated.` })

  if (overnightSummary?.avg_overnight_glucose > 0) {
    out.push(overnightSummary.dawn_pct > 50
      ? { type: 'warning', text: `Dawn phenomenon detected on ${overnightSummary.dawn_pct}% of nights — cortisol-driven early morning glucose rise.` }
      : { type: 'success', text: `Overnight glucose was stable on ${overnightSummary.stable_nights} of ${n} nights.` })
  }

  out.push(Number(daily) > 2
    ? { type: 'danger',  text: `Averaging ${daily} spikes/day — focus on meal composition and post-meal movement.` }
    : { type: 'success', text: `Good spike control — averaging ${daily} spikes per day across the stint.` })

  return out
}

export function computeTimeline(readings) {
  return readings
    .filter(r => r.glucose_value != null)
    .map(r => ({ t: r.timestamp, g: r.glucose_value }))
}
