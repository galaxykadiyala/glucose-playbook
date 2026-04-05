#!/usr/bin/env node
/**
 * Ultrahuman CGM CSV Parser
 * Converts raw Ultrahuman export CSV files into clean JSON for analytics.
 *
 * Input:  { Timestamp, "Glucose Reading/Event" }
 * Output: downsampled 5-min readings + pre-computed daily summaries
 *
 * Usage: node scripts/parseUltrahuman.js
 */

const fs   = require('fs')
const path = require('path')

const RAW_DIR   = path.join(__dirname, '../src/data/raw_data')
const OUT_DIR   = path.join(__dirname, '../src/data')

const FILES = [
  {
    input:    'Glucose_data_stint_2_28Feb_15Mar_UH.csv',
    stintId:  'stint_2',
    label:    'Feb 28 – Mar 15, 2026',
  },
  {
    input:    'Glucose_data_stint_3_15Mar_30Mar_UH.csv',
    stintId:  'stint_3',
    label:    'Mar 15 – Mar 30, 2026',
  },
]

// ─── Parse a single CSV file into clean { timestamp, glucose } array ──────────

function parseCsv(filePath) {
  const raw   = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n').slice(1) // skip header
  const readings = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const commaIdx = trimmed.indexOf(',')
    if (commaIdx === -1) continue

    const timestamp = trimmed.slice(0, commaIdx).trim()
    const valueStr  = trimmed.slice(commaIdx + 1).trim()

    // Skip non-numeric rows (activity labels like "Outdoor Walking")
    const value = Number(valueStr)
    if (isNaN(value) || value <= 0) continue

    // Sanity-check glucose range (20–400 mg/dL)
    if (value < 20 || value > 400) continue

    readings.push({ timestamp, glucose: value })
  }

  return readings
}

// ─── Downsample to ~5-minute intervals ────────────────────────────────────────
// Groups readings into 5-minute buckets and averages them.

function downsample(readings, intervalMin = 5) {
  const buckets = {}

  for (const r of readings) {
    const dt = new Date(r.timestamp)
    const totalMin = dt.getHours() * 60 + dt.getMinutes()
    const bucket   = Math.floor(totalMin / intervalMin) * intervalMin

    const dateStr   = r.timestamp.slice(0, 10)
    const bucketHH  = String(Math.floor(bucket / 60)).padStart(2, '0')
    const bucketMM  = String(bucket % 60).padStart(2, '0')
    const key       = `${dateStr}T${bucketHH}:${bucketMM}:00`

    if (!buckets[key]) buckets[key] = []
    buckets[key].push(r.glucose)
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, values]) => ({
      timestamp,
      glucose: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }))
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

function stats(values) {
  if (values.length === 0) return null
  const sum  = values.reduce((a, b) => a + b, 0)
  const avg  = sum / values.length
  const sq   = values.reduce((a, b) => a + (b - avg) ** 2, 0)
  const sd   = Math.sqrt(sq / values.length)
  const cv   = avg > 0 ? (sd / avg) * 100 : 0
  return {
    avg:  Math.round(avg),
    min:  Math.min(...values),
    max:  Math.max(...values),
    sd:   Math.round(sd * 10) / 10,
    cv:   Math.round(cv * 10) / 10,
    count: values.length,
  }
}

// ─── Time-in-range ────────────────────────────────────────────────────────────

function calcTIR(values) {
  const total = values.length
  if (total === 0) return { low: 0, inRange: 0, elevated: 0, high: 0 }
  return {
    low:      Math.round((values.filter(v => v < 70).length  / total) * 100),
    inRange:  Math.round((values.filter(v => v >= 70 && v <= 140).length / total) * 100),
    elevated: Math.round((values.filter(v => v > 140 && v <= 180).length / total) * 100),
    high:     Math.round((values.filter(v => v > 180).length / total) * 100),
  }
}

// ─── Spike detection ─────────────────────────────────────────────────────────
// A spike = rise of >30 mg/dL within a 90-min window, then a fall back.

function detectSpikes(readings) {
  const spikes = []
  const RISE_THRESHOLD = 30
  const WINDOW_MIN     = 90

  let i = 0
  while (i < readings.length) {
    const base     = readings[i].glucose
    const baseTime = new Date(readings[i].timestamp)
    let   peak     = base
    let   peakIdx  = i

    // Look ahead up to WINDOW_MIN minutes
    let j = i + 1
    while (j < readings.length) {
      const dt = (new Date(readings[j].timestamp) - baseTime) / 60000
      if (dt > WINDOW_MIN) break
      if (readings[j].glucose > peak) {
        peak    = readings[j].glucose
        peakIdx = j
      }
      j++
    }

    if (peak - base >= RISE_THRESHOLD) {
      // Find end of spike (return within 40% of rise)
      const target    = base + (peak - base) * 0.4
      let   endIdx    = peakIdx
      let   k         = peakIdx + 1
      while (k < readings.length) {
        if (readings[k].glucose <= target) { endIdx = k; break }
        k++
      }
      if (endIdx === peakIdx) endIdx = Math.min(peakIdx + 18, readings.length - 1)

      const durationMin = Math.round(
        (new Date(readings[endIdx].timestamp) - new Date(readings[i].timestamp)) / 60000
      )

      const startHour = new Date(readings[i].timestamp).getHours()
      const tod = startHour < 6  ? 'night'
                : startHour < 12 ? 'morning'
                : startHour < 18 ? 'afternoon'
                : startHour < 22 ? 'evening'
                : 'night'

      spikes.push({
        startTimestamp: readings[i].timestamp,
        peakTimestamp:  readings[peakIdx].timestamp,
        baselineGlucose: base,
        peakGlucose:    peak,
        rise:           peak - base,
        durationMin,
        timeOfDay: tod,
        date: readings[i].timestamp.slice(0, 10),
      })

      i = peakIdx + 1
      continue
    }
    i++
  }

  return spikes
}

// ─── Dawn phenomenon detection ────────────────────────────────────────────────
// Rise of >15 mg/dL between 04:00–07:00 with prior nadir in 02:00–04:00

function detectDawnPhenomenon(dayReadings) {
  const earlyMorn = dayReadings.filter(r => {
    const h = new Date(r.timestamp).getHours()
    return h >= 2 && h <= 4
  })
  const dawn = dayReadings.filter(r => {
    const h = new Date(r.timestamp).getHours()
    return h >= 4 && h <= 7
  })
  if (earlyMorn.length < 3 || dawn.length < 3) return false

  const nadir    = Math.min(...earlyMorn.map(r => r.glucose))
  const dawnPeak = Math.max(...dawn.map(r => r.glucose))
  return dawnPeak - nadir >= 15
}

// ─── Daily summary ────────────────────────────────────────────────────────────

function buildDailySummary(date, dayReadings, daySpikes) {
  const values = dayReadings.map(r => r.glucose)
  const st     = stats(values)
  const tir    = calcTIR(values)

  if (!st) return null

  // Overnight readings: 22:00–06:00 (spanning midnight)
  const overnightReadings = dayReadings.filter(r => {
    const h = new Date(r.timestamp).getHours()
    return h >= 22 || h < 6
  })
  const overnightVals = overnightReadings.map(r => r.glucose)
  const overnightSt   = stats(overnightVals)

  const hasDawn    = detectDawnPhenomenon(dayReadings)
  const spikeCount = daySpikes.length

  // Metabolic health score (0–100)
  // Components: TIR (40pts), avg glucose (25pts), variability (20pts), spikes (15pts)
  const tirScore    = Math.round(tir.inRange * 0.4)
  const avgScore    = st.avg <= 100 ? 25
                    : st.avg <= 115 ? Math.round(25 - ((st.avg - 100) / 15) * 10)
                    : st.avg <= 140 ? Math.round(15 - ((st.avg - 115) / 25) * 10)
                    : Math.max(0, Math.round(5 - ((st.avg - 140) / 20) * 5))
  const cvScore     = st.cv <= 15 ? 20
                    : st.cv <= 25 ? Math.round(20 - ((st.cv - 15) / 10) * 10)
                    : Math.max(0, Math.round(10 - ((st.cv - 25) / 10) * 10))
  const spikeScore  = Math.max(0, 15 - spikeCount * 4)
  const totalScore  = Math.min(100, tirScore + avgScore + cvScore + spikeScore)

  // Human insight
  let insight = ''
  if (totalScore >= 80)        insight = 'Excellent glucose control — stable and in range all day'
  else if (totalScore >= 65)   insight = 'Good control with minor excursions'
  else if (spikeCount >= 4)    insight = 'Frequent spikes detected — review meal composition and timing'
  else if (st.cv > 30)         insight = 'High variability — erratic glucose pattern throughout the day'
  else if (st.avg > 150)       insight = 'Elevated average glucose — sustained hyperglycemia'
  else if (tir.inRange < 60)   insight = 'Low time-in-range — significant excursions above 140 mg/dL'
  else                         insight = 'Moderate control with room for improvement'

  // Overnight insight
  let overnightInsight = ''
  if (overnightSt) {
    if (hasDawn)                                     overnightInsight = 'Detected early morning rise (possible dawn phenomenon)'
    else if (overnightSt.sd <= 8)                    overnightInsight = 'Glucose remained stable overnight'
    else if (overnightSt.max > 160)                  overnightInsight = 'Nighttime spike detected'
    else if (overnightSt.avg > 130)                  overnightInsight = 'Elevated overnight glucose'
    else if (overnightSt.sd > 15)                    overnightInsight = 'High overnight variability detected'
    else                                              overnightInsight = 'Normal overnight glucose pattern'
  }

  return {
    date,
    stats: st,
    tir,
    spikeCount,
    score:  totalScore,
    insight,
    overnight: overnightSt ? {
      stats:    overnightSt,
      hasDawn,
      insight:  overnightInsight,
    } : null,
  }
}

// ─── Time-of-day breakdown ────────────────────────────────────────────────────

function buildTODBreakdown(readings, spikes) {
  const windows = {
    morning:   { label: 'Morning',   range: '6am–12pm',  hours: [6,12],   readings: [], spikes: 0 },
    afternoon: { label: 'Afternoon', range: '12pm–6pm',  hours: [12,18],  readings: [], spikes: 0 },
    evening:   { label: 'Evening',   range: '6pm–10pm',  hours: [18,22],  readings: [], spikes: 0 },
    night:     { label: 'Night',     range: '10pm–6am',  hours: [22,30],  readings: [], spikes: 0 },
  }

  for (const r of readings) {
    const h = new Date(r.timestamp).getHours()
    if (h >= 6  && h < 12) windows.morning.readings.push(r.glucose)
    if (h >= 12 && h < 18) windows.afternoon.readings.push(r.glucose)
    if (h >= 18 && h < 22) windows.evening.readings.push(r.glucose)
    if (h >= 22 || h < 6)  windows.night.readings.push(r.glucose)
  }

  for (const s of spikes) {
    if (windows[s.timeOfDay]) windows[s.timeOfDay].spikes++
  }

  const result = {}
  for (const [key, w] of Object.entries(windows)) {
    const st = stats(w.readings)
    result[key] = {
      label:       w.label,
      range:       w.range,
      avg:         st?.avg ?? null,
      max:         st?.max ?? null,
      sd:          st?.sd  ?? null,
      spikeCount:  w.spikes,
      readingCount: w.readings.length,
    }
  }

  // Find best/worst windows
  const withData = Object.entries(result).filter(([, v]) => v.avg !== null)
  const best   = withData.reduce((a, b) => a[1].avg < b[1].avg ? a : b, withData[0])
  const worst  = withData.reduce((a, b) => a[1].avg > b[1].avg ? a : b, withData[0])

  return {
    windows: result,
    bestWindow:  best?.[0]  ?? null,
    worstWindow: worst?.[0] ?? null,
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

function processFile({ input, stintId, label }) {
  const inputPath = path.join(RAW_DIR, input)
  console.log(`\nProcessing ${input}...`)

  const raw        = parseCsv(inputPath)
  console.log(`  Raw readings: ${raw.length}`)

  const readings   = downsample(raw, 5)
  console.log(`  Downsampled (5-min): ${readings.length}`)

  const spikes     = detectSpikes(readings)
  console.log(`  Spikes detected: ${spikes.length}`)

  // Group by date
  const byDate = {}
  for (const r of readings) {
    const date = r.timestamp.slice(0, 10)
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(r)
  }

  const dates = Object.keys(byDate).sort()
  console.log(`  Days: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days)`)

  // Build daily summaries
  const daily_summaries = []
  for (const date of dates) {
    const dayReadings = byDate[date]
    const daySpikes   = spikes.filter(s => s.date === date)
    const summary     = buildDailySummary(date, dayReadings, daySpikes)
    if (summary) daily_summaries.push(summary)
  }

  // TOD breakdown for full stint
  const tod = buildTODBreakdown(readings, spikes)

  // Overall stats
  const allVals   = readings.map(r => r.glucose)
  const overallSt = stats(allVals)
  const overallTIR = calcTIR(allVals)
  const avgScore  = Math.round(
    daily_summaries.reduce((a, b) => a + b.score, 0) / daily_summaries.length
  )

  const output = {
    metadata: {
      stint_id:    stintId,
      label,
      date_range:  { start: dates[0], end: dates[dates.length - 1] },
      total_days:  dates.length,
      total_readings: readings.length,
      interval_min: 5,
    },
    overall: {
      stats:      overallSt,
      tir:        overallTIR,
      avg_score:  avgScore,
      total_spikes: spikes.length,
    },
    time_of_day: tod,
    daily_summaries,
    spikes,
    readings,
  }

  const outPath = path.join(OUT_DIR, `${stintId}.json`)
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`  Written → src/data/${stintId}.json`)

  return output
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('Ultrahuman CGM Parser')
console.log('═'.repeat(40))

const results = FILES.map(processFile)

// Cross-stint comparison summary
const comparison = results.map(r => ({
  stint_id:   r.metadata.stint_id,
  label:      r.metadata.label,
  avg_glucose: r.overall.stats.avg,
  avg_score:  r.overall.avg_score,
  spike_count: r.overall.total_spikes,
  tir_in_range: r.overall.tir.inRange,
  sd:         r.overall.stats.sd,
  cv:         r.overall.stats.cv,
}))

const compPath = path.join(OUT_DIR, 'cgm_comparison.json')
fs.writeFileSync(compPath, JSON.stringify({ datasets: comparison }, null, 2))

console.log('\n✓ All files processed.')
console.log('\nStint comparison:')
for (const c of comparison) {
  console.log(`  ${c.stint_id}: avg ${c.avg_glucose} mg/dL | TIR ${c.tir_in_range}% | score ${c.avg_score} | spikes ${c.spike_count} | CV ${c.cv}%`)
}
