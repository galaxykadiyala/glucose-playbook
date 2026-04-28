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
