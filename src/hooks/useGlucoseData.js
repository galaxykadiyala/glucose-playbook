import { useMemo } from 'react'
import glucoseReadings from '../data/glucoseReadings.json'
import { calculateTIR, calculateStats, estimateA1C, countSpikes } from '../utils/glucoseUtils'
import { useStint } from '../context/StintContext'

export function useGlucoseData() {
  const { patternsData, hasData } = useStint()

  // Hardcoded fallback data
  const {
    metadata: hdMeta,
    sampleDay,
    weeklyData:     hdWeekly,
    hourlyAverages: hdHourly,
    weekSummary,
  } = glucoseReadings

  // Pick live vs hardcoded
  const metadata       = hasData && patternsData ? patternsData.metadata       : hdMeta
  const weeklyData     = hasData && patternsData ? patternsData.weeklyData     : hdWeekly
  const hourlyAverages = hasData && patternsData ? patternsData.hourlyAverages : hdHourly

  const sampleDayStats = useMemo(() => {
    if (hasData) return null
    const tir    = calculateTIR(sampleDay.readings)
    const stats  = calculateStats(sampleDay.readings)
    const spikes = countSpikes(sampleDay.readings)
    return { ...tir, ...stats, spikes, estimatedA1c: estimateA1C(stats.avg) }
  }, [hasData])

  const weeklyStats = useMemo(
    () => weeklyData.map(day => ({
      ...day,
      tir:   calculateTIR(day.readings),
      stats: calculateStats(day.readings),
    })),
    [weeklyData],
  )

  const events = useMemo(() => {
    if (hasData) return []
    return sampleDay.readings
      .filter(r => r.event)
      .map(r => ({ time: r.time, type: r.event, label: r.eventLabel, value: r.value }))
  }, [hasData])

  return {
    metadata,
    sampleDay:      hasData ? null : sampleDay,
    sampleDayStats,
    weeklyData,
    weeklyStats,
    hourlyAverages,
    weekSummary:    hasData ? null : weekSummary,
    events,
    isLive:         hasData,
  }
}
