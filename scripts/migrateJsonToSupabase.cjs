#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const userId = process.argv[2]
const apply = process.argv.includes('--apply')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

if (!UUID_RE.test(userId || '')) {
  console.error('Usage: node scripts/migrateJsonToSupabase.cjs <user_uuid> [--apply]')
  process.exit(1)
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const cgmData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/data/cgmData.json'), 'utf8'))
const readings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/data/glucoseReadings.json'), 'utf8'))

async function main() {
  const dates = readings.sampleDay.map((r) => r.time).sort()
  const start = dates[0]
  const end = dates[dates.length - 1]
  console.log(`[${apply ? 'APPLY' : 'DRY-RUN'}] Seed legacy glucose (${start} to ${end})`)

  const stints = [{ name: `Legacy Glucose ${start} to ${end}`, start_date: start.slice(0,10), end_date: end.slice(0,10), sensor_type: 'Legacy', user_id: userId }]
  const mealLogs = cgmData.meals.map((m) => ({ user_id: userId, timestamp: m.datetime, food_items: m.foods.map((f) => f.name).join(', '), notes: m.notes || null, source: 'migration', meal_type: m.meal_type || null, day_of_week: m.day_of_week || null, foods: m.foods || [], pre_meal: m.pre_meal || [], post_meal: m.post_meal || [], tags: m.tags || [] }))

  const readingRows = readings.sampleDay.map((r) => ({ user_id: userId, timestamp: r.time, glucose_value: r.value, event_label: null }))

  console.log(`Plan: 1 stint, ${readingRows.length} readings, ${mealLogs.length} meal_logs`)
  if (!apply) return

  let insertedStints = 0, insertedReadings = 0, insertedMeals = 0
  const { data: stintData, error: stintErr } = await supabase.from('cgm_stints').insert(stints).select('id')
  if (stintErr) throw stintErr
  insertedStints += stintData.length
  const stintId = stintData[0].id

  const readingsWithStint = readingRows.map((r) => ({ ...r, stint_id: stintId }))
  const { error: readErr } = await supabase.from('cgm_readings').insert(readingsWithStint)
  if (readErr) throw readErr
  insertedReadings += readingsWithStint.length

  const { error: mealErr } = await supabase.from('meal_logs').insert(mealLogs)
  if (mealErr) throw mealErr
  insertedMeals += mealLogs.length

  console.log(`Inserted ${insertedStints} stints, ${insertedReadings} readings, ${insertedMeals} meal_logs.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
