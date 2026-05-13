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
  const { data, error } = await supabase
    .from('cgm_readings')
    .select('*')
    .eq('stint_id', stintId)
    .order('timestamp', { ascending: true })
  if (error) throw error
  return data
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
  let query = supabase.from('meal_logs').select('*').eq('user_id', userId)
  if (since) query = query.gte('timestamp', since)
  if (until) query = query.lte('timestamp', until)
  const { data, error } = await query.order('timestamp', { ascending: true })
  if (error) throw error
  return data
}

export async function getManualGlucose(userId, { since, until } = {}) {
  let query = supabase.from('manual_glucose').select('*').eq('user_id', userId)
  if (since) query = query.gte('timestamp', since)
  if (until) query = query.lte('timestamp', until)
  const { data, error } = await query.order('timestamp', { ascending: true })
  if (error) throw error
  return data
}

export async function getAllReadings(userId) {
  const { data, error } = await supabase
    .from('cgm_readings')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true })
  if (error) throw error
  return data
}
