import { getMealLogs, getAllReadings } from './dataService'

const SPIKE_THRESHOLD = 140
const WINDOW_BEFORE_MIN = 30
const WINDOW_AFTER_MIN = 120

export async function buildMealsForUser(userId) {
  const [mealRows, readings] = await Promise.all([
    getMealLogs(userId),
    getAllReadings(userId),
  ])
  return mealRows.map((row) => buildMealFromRow(row, readings))
}

function buildMealFromRow(row, readings) {
  const t0 = new Date(row.timestamp).getTime()
  const before = readings.filter((r) => {
    const dt = new Date(r.timestamp).getTime()
    return dt >= t0 - WINDOW_BEFORE_MIN * 60000 && dt <= t0
  })
  const after = readings.filter((r) => {
    const dt = new Date(r.timestamp).getTime()
    return dt > t0 && dt <= t0 + WINDOW_AFTER_MIN * 60000
  })

  const baseline = before.length
    ? Math.round(before.reduce((s, r) => s + r.glucose_value, 0) / before.length)
    : null

  const peakReading = after.reduce(
    (max, r) => (max == null || r.glucose_value > max.glucose_value ? r : max),
    null,
  )

  const peak = peakReading?.glucose_value ?? null
  const delta = peak != null && baseline != null ? peak - baseline : null
  const peakTimeMin = peakReading
    ? Math.round((new Date(peakReading.timestamp).getTime() - t0) / 60000)
    : null

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
      readings: after.map((r) => ({
        time_min: Math.round((new Date(r.timestamp).getTime() - t0) / 60000),
        value: r.glucose_value,
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
  return text.split(',').map((s) => ({ name: s.trim(), gi_estimate: null, category: null }))
}

function severityFor(peak) {
  if (peak == null || peak <= 140) return 'none'
  if (peak <= 155) return 'mild'
  if (peak <= 170) return 'moderate'
  if (peak <= 185) return 'high'
  return 'very_high'
}
