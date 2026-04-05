/**
 * cgmAnalytics.js
 * UI-layer helpers for the processed Ultrahuman CGM data.
 * The heavy analytics (spike detection, daily summaries, TOD breakdown)
 * are pre-computed by the parseUltrahuman script and stored in JSON.
 * These helpers are for rendering, labeling, and cross-stint comparison.
 */

// ─── Score styling ────────────────────────────────────────────────────────────

export function scoreColor(score) {
  if (score >= 80) return { text: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Excellent' }
  if (score >= 65) return { text: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'Good' }
  if (score >= 50) return { text: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Fair' }
  return              { text: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Poor' }
}

export function scoreLabel(score) {
  return scoreColor(score).label
}

// ─── Glucose value styling ────────────────────────────────────────────────────

export function glucoseColor(value) {
  if (value < 70)               return { text: '#1D4ED8', bg: '#DBEAFE', label: 'Low' }
  if (value <= 100)             return { text: '#16A34A', bg: '#F0FDF4', label: 'Optimal' }
  if (value <= 140)             return { text: '#15803D', bg: '#F0FDF4', label: 'In Range' }
  if (value <= 180)             return { text: '#D97706', bg: '#FFFBEB', label: 'Elevated' }
  return                               { text: '#DC2626', bg: '#FEF2F2', label: 'High' }
}

// ─── TIR color ────────────────────────────────────────────────────────────────

export function tirColor(key) {
  const map = {
    low:      { fill: '#3B82F6', label: 'Low (<70)' },
    inRange:  { fill: '#22C55E', label: 'In Range (70–140)' },
    elevated: { fill: '#F59E0B', label: 'Elevated (140–180)' },
    high:     { fill: '#EF4444', label: 'High (>180)' },
  }
  return map[key] || { fill: '#94A3B8', label: key }
}

// ─── Time-of-day colors ───────────────────────────────────────────────────────

export function todColor(key) {
  const map = {
    morning:   { fill: '#F59E0B', light: '#FFFBEB', label: 'Morning' },
    afternoon: { fill: '#F97316', light: '#FFF7ED', label: 'Afternoon' },
    evening:   { fill: '#8B5CF6', light: '#F5F3FF', label: 'Evening' },
    night:     { fill: '#3B82F6', light: '#EFF6FF', label: 'Night' },
  }
  return map[key] || { fill: '#94A3B8', light: '#F8FAFC', label: key }
}

// ─── Overnight readings extractor ─────────────────────────────────────────────

/**
 * Given the full readings array and a target date,
 * returns readings from 22:00 the previous evening through 06:00 of the target date.
 * Useful for rendering the overnight glucose graph.
 */
export function getOvernightReadings(readings, targetDate) {
  const prev = new Date(targetDate)
  prev.setDate(prev.getDate() - 1)
  const prevStr = prev.toISOString().slice(0, 10)

  return readings.filter(r => {
    const ts   = r.timestamp
    const date = ts.slice(0, 10)
    const hour = parseInt(ts.slice(11, 13))

    // Previous day from 22:00 onwards
    if (date === prevStr && hour >= 22) return true
    // Target date up to 06:00
    if (date === targetDate && hour < 6) return true
    return false
  })
}

/**
 * Returns readings for a specific date (full day).
 */
export function getDayReadings(readings, date) {
  return readings.filter(r => r.timestamp.slice(0, 10) === date)
}

// ─── Cross-stint comparison ───────────────────────────────────────────────────

/**
 * Computes improvement/regression deltas between two stint summaries.
 * Negative values = improvement for glucose metrics (lower is better).
 * Positive scoreImprovement = better score (higher is better).
 */
export function compareStints(a, b) {
  const avgGlucoseDelta  = b.avg_glucose - a.avg_glucose
  const avgGlucosePct    = a.avg_glucose > 0 ? Math.round((avgGlucoseDelta / a.avg_glucose) * 100) : 0
  const tirDelta         = b.tir_in_range - a.tir_in_range
  const scoreDelta       = b.avg_score - a.avg_score
  const spikeDelta       = b.spike_count - a.spike_count
  const sdDelta          = b.sd - a.sd
  const cvDelta          = b.cv - a.cv

  return {
    avgGlucoseDelta,
    avgGlucosePct,
    tirDelta,
    scoreDelta,
    spikeDelta,
    sdDelta,
    cvDelta,
    // Overall verdict
    improved: scoreDelta > 0,
  }
}

/**
 * Formats a delta for display: returns "+5", "-3", "±0" and a color.
 */
export function formatDelta(delta, lowerIsBetter = true) {
  const improved = lowerIsBetter ? delta < 0 : delta > 0
  const color = delta === 0 ? '#64748B' : improved ? '#16A34A' : '#DC2626'
  const sign  = delta > 0 ? '+' : ''
  return { text: `${sign}${delta}`, color, improved }
}

// ─── Spike grouping helpers ───────────────────────────────────────────────────

export function groupSpikesByTOD(spikes) {
  const groups = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const s of spikes) {
    if (s.timeOfDay in groups) groups[s.timeOfDay]++
  }
  return groups
}

export function groupSpikesByDate(spikes) {
  const map = {}
  for (const s of spikes) {
    if (!map[s.date]) map[s.date] = []
    map[s.date].push(s)
  }
  return map
}

// ─── Score trend helpers ──────────────────────────────────────────────────────

/**
 * Returns the 7-day rolling average score for each day in daily_summaries.
 */
export function rollingAvgScore(dailySummaries, window = 7) {
  return dailySummaries.map((day, i) => {
    const slice  = dailySummaries.slice(Math.max(0, i - window + 1), i + 1)
    const avg    = Math.round(slice.reduce((a, d) => a + d.score, 0) / slice.length)
    return { date: day.date, score: day.score, rollingAvg: avg }
  })
}

/**
 * Returns a short date label like "Mar 1" from a date string.
 */
export function shortDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
