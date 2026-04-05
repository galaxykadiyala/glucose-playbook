import { useMemo } from 'react'
import glucoseReadings from '../data/glucoseReadings.json'
import { calculateTIR, calculateStats, estimateA1C, countSpikes } from '../utils/glucoseUtils'

export function useGlucoseData() {
  const { metadata, sampleDay, weeklyData, hourlyAverages, weekSummary } = glucoseReadings

  const sampleDayStats = useMemo(() => {
    const tir = calculateTIR(sampleDay.readings)
    const stats = calculateStats(sampleDay.readings)
    const spikes = countSpikes(sampleDay.readings)
    return {
      ...tir,
      ...stats,
      spikes,
      estimatedA1c: estimateA1C(stats.avg),
    }
  }, [])

  const weeklyStats = useMemo(() => {
    return weeklyData.map(day => ({
      ...day,
      tir: calculateTIR(day.readings),
      stats: calculateStats(day.readings),
    }))
  }, [])

  const events = useMemo(() => {
    return sampleDay.readings
      .filter(r => r.event)
      .map(r => ({ time: r.time, type: r.event, label: r.eventLabel, value: r.value }))
  }, [])

  return {
    metadata,
    sampleDay,
    sampleDayStats,
    weeklyData,
    weeklyStats,
    hourlyAverages,
    weekSummary,
    events,
  }
}
