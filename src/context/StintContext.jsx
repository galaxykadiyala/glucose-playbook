import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { useUser } from './UserContext'
import { getStints, getReadings } from '../lib/dataService'
import {
  computeMetadata, computeHourlyAverages, computeWeeklyData,
  computeDailySummaries, computeOvernightAnalysis, computeTODBreakdown,
  computeSpikeList, computeOvernightSummary, computeBestWorstDays,
  computeTextInsights, computeTimeline,
} from '../utils/stintAnalytics'

const StintContext = createContext(null)

export function StintProvider({ children }) {
  const { user } = useUser()
  const [stints, setStints]                   = useState([])
  const [selectedStintId, setSelectedStintId] = useState(null)
  const [readings, setReadings]               = useState([])
  const [loading, setLoading]                 = useState(false)

  // Load stints whenever the logged-in user changes
  useEffect(() => {
    if (!user) { setStints([]); setSelectedStintId(null); setReadings([]); return }
    setLoading(true)
    getStints(user.id)
      .then(data => { setStints(data); if (data.length) setSelectedStintId(data[0].id) })
      .finally(() => setLoading(false))
  }, [user])

  // Load readings whenever selected stint changes
  useEffect(() => {
    if (!selectedStintId) { setReadings([]); return }
    setLoading(true)
    getReadings(selectedStintId)
      .then(setReadings)
      .finally(() => setLoading(false))
  }, [selectedStintId])

  const selectedStint = stints.find(s => s.id === selectedStintId) ?? null

  // DailyIntelligence-compatible phase data object
  const stintPhaseData = useMemo(() => {
    if (!readings.length) return null
    const dailySummaries    = computeDailySummaries(readings)
    const overnightAnalysis = computeOvernightAnalysis(readings)
    const todBreakdown      = computeTODBreakdown(readings)
    const spikeList         = computeSpikeList(readings)
    const overnightSummary  = computeOvernightSummary(overnightAnalysis)
    const { best_days, worst_days } = computeBestWorstDays(dailySummaries)
    return {
      label:              selectedStint?.name ?? 'Current Stint',
      date_label:         selectedStint ? `${selectedStint.start_date} – ${selectedStint.end_date}` : '',
      daily_summaries:    dailySummaries,
      overnight_analysis: overnightAnalysis,
      tod_breakdown:      todBreakdown,
      spike_list:         spikeList,
      overnight_summary:  overnightSummary,
      best_days,
      worst_days,
      text_insights:      computeTextInsights(dailySummaries, todBreakdown, overnightSummary),
      chart_data:         { glucose_timeline: computeTimeline(readings) },
      deep:               null, // deep analytics require pre-computed pipeline
    }
  }, [readings, selectedStint])

  // Patterns-page-compatible data
  const patternsData = useMemo(() => {
    if (!readings.length) return null
    return {
      metadata:       computeMetadata(readings),
      weeklyData:     computeWeeklyData(readings),
      hourlyAverages: computeHourlyAverages(readings),
    }
  }, [readings])

  return (
    <StintContext.Provider value={{
      stints,
      selectedStint,
      selectedStintId,
      setSelectedStintId,
      readings,
      stintPhaseData,
      patternsData,
      loading,
      hasData: stints.length > 0,
    }}>
      {children}
    </StintContext.Provider>
  )
}

export function useStint() {
  return useContext(StintContext)
}
