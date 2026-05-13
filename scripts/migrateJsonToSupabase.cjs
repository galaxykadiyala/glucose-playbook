#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const args = process.argv.slice(2)
const hasExecute = args.includes('--execute')
const hasDryRun = args.includes('--dry-run')
const userId = args.find(a => !a.startsWith('--'))

function usage() {
  console.error('Usage: node scripts/migrateJsonToSupabase.cjs <user_id> [--dry-run] [--execute]')
  console.error('  --dry-run  Default mode. Prints counts/samples only (no writes).')
  console.error('  --execute  Performs inserts. Required for any write.')
}

if (!userId) {
  usage()
  process.exit(1)
}
if (hasExecute && hasDryRun) {
  console.error('Pass only one mode flag: either --dry-run or --execute.')
  process.exit(1)
}

const execute = hasExecute
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Export both before running:')
  console.error('export SUPABASE_URL=...')
  console.error('export SUPABASE_SERVICE_ROLE_KEY=...')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const root = path.resolve(__dirname, '..')
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))
const hash = v => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 10)

async function ensureStint(name, startDate, endDate, counters) {
  const { data: existing, error: existingError } = await supabase
    .from('cgm_stints')
    .select('*')
    .eq('user_id', userId)
    .eq('name', name)
    .limit(1)

  if (existingError) throw existingError
  if (existing?.[0]) return existing[0]

  const row = { user_id: userId, name, start_date: startDate, end_date: endDate, sensor_type: 'Ultrahuman' }
  counters.cgm_stints += 1
  counters.cgm_stints_samples.push(row)

  if (!execute) return { id: `dry-${name}`, ...row }

  const { data, error } = await supabase.from('cgm_stints').insert(row).select().single()
  if (error) throw error
  return data
}

async function main() {
  const counters = { cgm_stints: 0, meal_logs: 0, cgm_readings: 0, cgm_stints_samples: [] }

  const cgmData = read('src/data/cgmData.json')
  const stint2 = read('src/data/stint_2.json')
  const stint3 = read('src/data/stint_3.json')
  const glucoseReadings = read('src/data/glucoseReadings.json')

  const mealRows = cgmData.meals.map(meal => ({
    user_id: userId,
    timestamp: meal.datetime,
    food_items: meal.foods.map(f => f.name).join(', '),
    notes: `seed:${meal.id}:${hash(meal)}`,
    source: 'seed',
  }))

  const s2 = await ensureStint('Seed Stint 2', stint2.metadata.start_date, stint2.metadata.end_date, counters)
  const s3 = await ensureStint('Seed Stint 3', stint3.metadata.start_date, stint3.metadata.end_date, counters)
  const legacy = await ensureStint('Seed Legacy Glucose', glucoseReadings.metadata.startDate, glucoseReadings.metadata.endDate, counters)

  const readingRows = [
    ...stint2.readings.map(r => ({ user_id: userId, stint_id: s2.id, timestamp: r.timestamp, glucose_value: r.value, event_label: null })),
    ...stint3.readings.map(r => ({ user_id: userId, stint_id: s3.id, timestamp: r.timestamp, glucose_value: r.value, event_label: null })),
    ...glucoseReadings.sampleDay.readings.map(r => ({ user_id: userId, stint_id: legacy.id, timestamp: r.timestamp, glucose_value: r.value, event_label: null })),
  ]

  const { data: existingMeals, error: mealsErr } = await supabase.from('meal_logs').select('notes').eq('user_id', userId).eq('source', 'seed')
  if (mealsErr) throw mealsErr
  const mealNotes = new Set((existingMeals || []).map(r => r.notes))
  const mealsToInsert = mealRows.filter(r => !mealNotes.has(r.notes))

  const { data: existingReadings, error: readingsErr } = await supabase
    .from('cgm_readings')
    .select('stint_id,timestamp,glucose_value,event_label')
    .eq('user_id', userId)
  if (readingsErr) throw readingsErr
  const readingKeys = new Set((existingReadings || []).map(r => `${r.stint_id}|${r.timestamp}|${r.glucose_value ?? ''}|${r.event_label ?? ''}`))
  const readingsToInsert = readingRows.filter(r => !readingKeys.has(`${r.stint_id}|${r.timestamp}|${r.glucose_value ?? ''}|${r.event_label ?? ''}`))

  counters.meal_logs = mealsToInsert.length
  counters.cgm_readings = readingsToInsert.length

  console.log(execute ? 'MODE: execute' : 'MODE: dry-run')
  console.log('cgm_stints rows:', counters.cgm_stints)
  console.log(counters.cgm_stints_samples.slice(0, 3))
  console.log('meal_logs rows:', counters.meal_logs)
  console.log(mealsToInsert.slice(0, 3))
  console.log('cgm_readings rows:', counters.cgm_readings)
  console.log(readingsToInsert.slice(0, 3))

  if (!execute) return

  if (mealsToInsert.length) {
    const { error } = await supabase.from('meal_logs').insert(mealsToInsert)
    if (error) throw error
  }
  if (readingsToInsert.length) {
    const { error } = await supabase.from('cgm_readings').insert(readingsToInsert)
    if (error) throw error
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
