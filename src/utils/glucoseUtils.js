export const GLUCOSE_ZONES = {
  LOW:       { max: 70,  label: 'Low',        color: '#EF4444', bg: '#FEF2F2' },
  NORMAL:    { max: 140, label: 'In Range',    color: '#22C55E', bg: '#F0FDF4' },
  ELEVATED:  { max: 180, label: 'Elevated',   color: '#F59E0B', bg: '#FFFBEB' },
  HIGH:      { max: Infinity, label: 'High',  color: '#EF4444', bg: '#FEF2F2' },
}

export function getGlucoseZone(value) {
  if (value < 70)  return 'low'
  if (value <= 140) return 'normal'
  if (value <= 180) return 'elevated'
  return 'high'
}

export function getZoneColor(value) {
  const zone = getGlucoseZone(value)
  const map = {
    low:      '#EF4444',
    normal:   '#22C55E',
    elevated: '#F59E0B',
    high:     '#EF4444',
  }
  return map[zone]
}

export function getZoneLabel(value) {
  const zone = getGlucoseZone(value)
  const map = {
    low:      'Low',
    normal:   'In Range',
    elevated: 'Elevated',
    high:     'High',
  }
  return map[zone]
}

export function calculateTIR(readings) {
  if (!readings || readings.length === 0) return { inRange: 0, low: 0, elevated: 0, high: 0 }
  const total = readings.length
  let inRange = 0, low = 0, elevated = 0, high = 0

  readings.forEach(r => {
    const v = typeof r === 'number' ? r : r.value
    if (v < 70) low++
    else if (v <= 140) inRange++
    else if (v <= 180) elevated++
    else high++
  })

  return {
    inRange:  Math.round((inRange / total) * 100),
    low:      Math.round((low / total) * 100),
    elevated: Math.round((elevated / total) * 100),
    high:     Math.round((high / total) * 100),
  }
}

export function calculateStats(readings) {
  if (!readings || readings.length === 0) return {}
  const values = readings.map(r => (typeof r === 'number' ? r : r.value))
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)

  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  const cv = (stdDev / avg) * 100 // Coefficient of Variation

  return {
    avg:    Math.round(avg),
    min,
    max,
    stdDev: Math.round(stdDev),
    cv:     Math.round(cv),
  }
}

export function estimateA1C(avgGlucose) {
  // ADAG formula: A1C = (avgGlucose + 46.7) / 28.7
  return ((avgGlucose + 46.7) / 28.7).toFixed(1)
}

export function getA1CCategory(a1c) {
  const v = parseFloat(a1c)
  if (v < 5.7)  return { label: 'Normal',     color: '#22C55E' }
  if (v < 6.5)  return { label: 'Pre-diabetic', color: '#F59E0B' }
  return              { label: 'Diabetic',    color: '#EF4444' }
}

export function countSpikes(readings, threshold = 140) {
  const values = readings.map(r => (typeof r === 'number' ? r : r.value))
  let spikes = 0
  let inSpike = false
  values.forEach(v => {
    if (v > threshold && !inSpike) { spikes++; inSpike = true }
    if (v <= threshold) inSpike = false
  })
  return spikes
}

export function getSpikeEvents(readings, threshold = 140) {
  const events = []
  let inSpike = false
  let spikeStart = null
  let peakValue = 0
  let peakTime = null

  readings.forEach((r, i) => {
    const v = typeof r === 'number' ? r : r.value
    const t = typeof r === 'number' ? i : r.time

    if (v > threshold && !inSpike) {
      inSpike = true
      spikeStart = t
      peakValue = v
      peakTime = t
    } else if (v > threshold && inSpike) {
      if (v > peakValue) { peakValue = v; peakTime = t }
    } else if (v <= threshold && inSpike) {
      events.push({ start: spikeStart, end: t, peak: peakValue, peakTime })
      inSpike = false
      spikeStart = null
      peakValue = 0
    }
  })

  return events
}

export function formatGlucoseValue(value) {
  return `${value} mg/dL`
}

export function getVariabilityLabel(cv) {
  if (cv < 20) return { label: 'Stable',   color: '#22C55E' }
  if (cv < 36) return { label: 'Moderate', color: '#F59E0B' }
  return             { label: 'High',      color: '#EF4444' }
}
