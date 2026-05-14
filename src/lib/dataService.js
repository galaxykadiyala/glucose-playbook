import { supabase } from './supabase'

export async function getStints(userId) {
  const { data, error } = await supabase
    .from('cgm_stints')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getReadings(stintId) {
  return paginate((from, to) =>
    supabase
      .from('cgm_readings')
      .select('*')
      .eq('stint_id', stintId)
      .order('timestamp', { ascending: true })
      .range(from, to)
  )
}

export async function getCurrentStint(userId) {
  const { data, error } = await supabase
    .from('cgm_stints')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(1)
    .single()
  if (error) throw error
  return data
}


export async function getMealLogs(userId, { since, until } = {}) {
  let query = supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true })

  if (since) query = query.gte('timestamp', since)
  if (until) query = query.lte('timestamp', until)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getManualGlucose(userId, { since, until } = {}) {
  let query = supabase
    .from('manual_glucose')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true })

  if (since) query = query.gte('timestamp', since)
  if (until) query = query.lte('timestamp', until)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getAllReadings(userId, { since, until } = {}) {
  return paginate((from, to) => {
    let q = supabase
      .from('cgm_readings')
      .select('timestamp, glucose_value, stint_id, cgm_stints!inner(user_id)')
      .eq('cgm_stints.user_id', userId)
      .order('timestamp', { ascending: true })
      .range(from, to)
    if (since) q = q.gte('timestamp', since)
    if (until) q = q.lte('timestamp', until)
    return q
  })
}

async function paginate(queryFn, pageSize = 1000) {
  const out = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFn(from, from + pageSize - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}
