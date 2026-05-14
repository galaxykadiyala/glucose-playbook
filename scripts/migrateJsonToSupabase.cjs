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
const stint2 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/data/stint_2.json'), 'utf8'))
const stint3 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/data/stint_3.json'), 'utf8'))

async function ensureStint(stint) {
  const { data: existing, error: findErr } = await supabase
    .from('cgm_stints')
    .select('id')
    .eq('user_id', userId)
    .eq('name', stint.name)
    .limit(1)
  if (findErr) throw findErr
  if (existing.length) return { id: existing[0].id, inserted: false }

  const { data, error } = await supabase.from('cgm_stints').insert([{ ...stint, user_id: userId }]).select('id').single()
  if (error) throw error
  return { id: data.id, inserted: true }
}

async function insertReadings(stintId, rows) {
  const { data: existing, error: readErr } = await supabase
    .from('cgm_readings')
    .select('timestamp')
    .eq('stint_id', stintId)
  if (readErr) throw readErr
  const existingSet = new Set(existing.map((r) => r.timestamp))
  const inserts = rows.filter((r) => !existingSet.has(r.timestamp))
  if (!inserts.length) return 0
  const { error } = await supabase.from('cgm_readings').insert(inserts.map((r) => ({ ...r, stint_id: stintId, user_id: userId })))
  if (error) throw error
  return inserts.length
}

async function insertMeals() {
  const notes = cgmData.meals.map((m) => `seed:${m.id}`)
  const { data: existing, error: existErr } = await supabase
    .from('meal_logs')
    .select('notes')
    .eq('user_id', userId)
    .in('notes', notes)
  if (existErr) throw existErr
  const existingNotes = new Set(existing.map((m) => m.notes))

  const rows = cgmData.meals
    .filter((m) => !existingNotes.has(`seed:${m.id}`))
    .map((m) => ({
      user_id: userId,
      timestamp: m.datetime,
      food_items: m.foods.map((f) => f.name).join(', '),
      notes: `seed:${m.id}`,
      source: 'migration',
      meal_type: m.meal_type || null,
      day_of_week: m.day_of_week || null,
      foods: m.foods || [],
      pre_meal: m.pre_meal || [],
      post_meal: m.post_meal || [],
      tags: m.tags || [],
    }))

  if (!rows.length) return 0
  const { error } = await supabase.from('meal_logs').insert(rows)
  if (error) throw error
  return rows.length
}

async function main() {
  const day = readings.sampleDay.date
  const meta = readings.metadata
  console.log(`[${apply ? 'APPLY' : 'DRY-RUN'}] Seed glucose (${meta.startDate} to ${meta.endDate})`)

  const legacyStint = { name: `Legacy Glucose ${meta.startDate} to ${meta.endDate}`, start_date: meta.startDate, end_date: meta.endDate, sensor_type: 'Legacy' }
  const sampleRows = readings.sampleDay.readings.map((r) => ({ timestamp: `${day}T${r.time}:00Z`, glucose_value: r.value, event_label: null }))

  const stintRows = [
    { name: 'Stint 2', start_date: stint2.metadata.startDate, end_date: stint2.metadata.endDate, sensor_type: 'Freestyle Libre', rows: stint2.readings.map((r) => ({ timestamp: r.timestamp, glucose_value: r.value, event_label: null })) },
    { name: 'Stint 3', start_date: stint3.metadata.startDate, end_date: stint3.metadata.endDate, sensor_type: 'Freestyle Libre', rows: stint3.readings.map((r) => ({ timestamp: r.timestamp, glucose_value: r.value, event_label: null })) },
  ]

  console.log(`Plan: legacy + ${stintRows.length} stints, ${sampleRows.length + stintRows.reduce((a,s)=>a+s.rows.length,0)} readings, ${cgmData.meals.length} meal_logs`)
  if (!apply) return

  let insertedStints = 0
  let insertedReadings = 0

  const legacy = await ensureStint(legacyStint)
  if (legacy.inserted) insertedStints += 1
  insertedReadings += await insertReadings(legacy.id, sampleRows)

  for (const s of stintRows) {
    const ensured = await ensureStint({ name: s.name, start_date: s.start_date, end_date: s.end_date, sensor_type: s.sensor_type })
    if (ensured.inserted) insertedStints += 1
    insertedReadings += await insertReadings(ensured.id, s.rows)
  }

  const insertedMeals = await insertMeals()
  console.log(`Inserted ${insertedStints} stints, ${insertedReadings} readings, ${insertedMeals} meal_logs.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
