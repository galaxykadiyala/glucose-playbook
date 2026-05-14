import { useMemo } from 'react'
import glucoseReadings from '../data/glucoseReadings.json'
import { calculateTIR, calculateStats, estimateA1C, countSpikes } from '../utils/glucoseUtils'

// Patterns / DailyIntelligence currently consume precomputed weekly + hourly aggregates
// that the live Supabase pipeline doesn't produce yet. Phase 4 will wire these to real
// data; until then this hook always returns the JSON demo dataset so those pages render.
export function useGlucoseData() {
  const {
    metadata,
    sampleDay,
    weeklyData,
    hourlyAverages,
    weekSummary,
  } = glucoseReadings

  const sampleDayStats = useMemo(() => {
    const tir    = calculateTIR(sampleDay.readings)
    const stats  = calculateStats(sampleDay.readings)
    const spikes = countSpikes(sampleDay.readings)
    return { ...tir, ...stats, spikes, estimatedA1c: estimateA1C(stats.avg) }
  }, [])

  const weeklyStats = useMemo(
    () => weeklyData.map(day => ({
      ...day,
      tir:   calculateTIR(day.readings),
      stats: calculateStats(day.readings),
    })),
    [],
  )

  const events = useMemo(
    () => sampleDay.readings
      .filter(r => r.event)
      .map(r => ({ time: r.time, type: r.event, label: r.eventLabel, value: r.value })),
    [],
  )

  return {
    metadata,
    sampleDay,
    sampleDayStats,
    weeklyData,
    weeklyStats,
    hourlyAverages,
    weekSummary,
    events,
    isLive: false,
  }
}
