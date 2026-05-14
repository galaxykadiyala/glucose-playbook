const SPIKE_THRESHOLD = 140
const WINDOW_BEFORE_MIN = 30
const WINDOW_AFTER_MIN = 120

export function buildMealsFromRows(mealRows, readings) {
  const ts = readings.map(r => ({
    ts: new Date(r.timestamp).getTime(),
    value: r.glucose_value,
  }))
  return mealRows.map(row => buildMealFromRow(row, ts))
}

function buildMealFromRow(row, readingTs) {
  const t0 = new Date(row.timestamp).getTime()
  const beforeStart = t0 - WINDOW_BEFORE_MIN * 60000
  const afterEnd = t0 + WINDOW_AFTER_MIN * 60000

  let baselineSum = 0
  let baselineN = 0
  let peakReading = null
  const afterReadings = []

  for (const r of readingTs) {
    if (r.ts < beforeStart) continue
    if (r.ts > afterEnd) break // readings are sorted ascending
    if (r.ts <= t0) {
      baselineSum += r.value
      baselineN++
    } else {
      afterReadings.push(r)
      if (peakReading == null || r.value > peakReading.value) peakReading = r
    }
  }

  const baseline = baselineN ? Math.round(baselineSum / baselineN) : null
  const peak = peakReading?.value ?? null
  const delta = peak != null && baseline != null ? peak - baseline : null
  const peakTimeMin = peakReading ? Math.round((peakReading.ts - t0) / 60000) : null
  const spike = peak != null ? peak > SPIKE_THRESHOLD : false
  const seedMatch = /^seed:(meal_\d+)/.exec(row.notes || '')

  return {
    id: row.id,
    datetime: row.timestamp,
    date: row.timestamp.slice(0, 10),
    day_of_week: row.day_of_week ?? new Date(row.timestamp).toLocaleDateString('en-US', { weekday: 'long' }),
    meal_type: row.meal_type ?? 'unknown',
    foods: row.foods?.length ? row.foods : parseFoodsText(row.food_items),
    pre_meal: row.pre_meal ?? [],
    post_meal: row.post_meal ?? [],
    glucose: {
      baseline,
      peak,
      delta,
      peak_time_min: peakTimeMin,
      readings: afterReadings.map(r => ({
        time_min: Math.round((r.ts - t0) / 60000),
        value: r.value,
      })),
    },
    spike,
    spike_severity: severityFor(peak),
    tags: row.tags ?? [],
    notes: row.notes ?? '',
    seedId: seedMatch ? seedMatch[1] : null,
    label: row.food_items ?? '',
    _hasGlucoseData: peak != null,
  }
}

function parseFoodsText(text) {
  if (!text) return []
  return text.split(',').map(s => ({ name: s.trim(), gi_estimate: null, category: null }))
}

function severityFor(peak) {
  if (peak == null || peak <= 140) return 'none'
  if (peak <= 155) return 'mild'
  if (peak <= 170) return 'moderate'
  if (peak <= 185) return 'high'
  return 'very_high'
}
