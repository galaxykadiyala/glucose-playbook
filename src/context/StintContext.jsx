import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { useUser } from './UserContext'
import { getStints, getAllReadings, getMealLogs, getManualGlucose } from '../lib/dataService'
import { buildMealsFromRows } from '../lib/mealAdapter'
import { supabase } from '../lib/supabase'

const StintContext = createContext(null)

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthKeyFromDate(yyyymmdd) {
  return yyyymmdd.slice(0, 7) // "2026-03"
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}

function monthRange(key) {
  const [y, m] = key.split('-').map(Number)
  const since = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01T00:00:00Z`
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  const until = `${String(next.y).padStart(4, '0')}-${String(next.m).padStart(2, '0')}-01T00:00:00Z`
  return { since, until }
}

export function StintProvider({ children }) {
  const { user } = useUser()
  const [stints, setStints] = useState([])
  const [monthsWithData, setMonthsWithData] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null) // null = "All time"

  // Cached, fetched-once-per-user
  const [allReadings, setAllReadings] = useState(null)
  const [allMealRows, setAllMealRows] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setStints([])
      setMonthsWithData([])
      setSelectedMonth(null)
      setAllReadings(null)
      setAllMealRows(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getStints(user.id),
      getMealLogs(user.id),
      getAllReadings(user.id),
      getManualGlucose(user.id),
    ])
      .then(([stintData, mealRows, readings, manualReadings]) => {
        if (cancelled) return
        setStints(stintData)
        setAllMealRows(mealRows)
        const merged = [...readings, ...manualReadings]
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        setAllReadings(merged)
        const all = new Set(mealRows.map(r => monthKeyFromDate(r.timestamp)))
        for (const r of manualReadings) all.add(monthKeyFromDate(r.timestamp))
        for (const s of stintData) {
          for (const k of expandRangeMonths(s.start_date, s.end_date)) all.add(k)
        }
        setMonthsWithData([...all].sort().reverse())
      })
      .catch(e => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  const months = useMemo(
    () => monthsWithData.map(key => ({ key, label: monthLabel(key), ...monthRange(key) })),
    [monthsWithData],
  )

  const activeRange = useMemo(
    () => selectedMonth ? monthRange(selectedMonth) : { since: null, until: null },
    [selectedMonth],
  )

  // Adapt + filter once, share across pages
  const meals = useMemo(() => {
    if (!allMealRows || !allReadings) return null
    const adapted = buildMealsFromRows(allMealRows, allReadings)
    if (!activeRange.since) return adapted
    const sinceTs = new Date(activeRange.since).getTime()
    const untilTs = new Date(activeRange.until).getTime()
    return adapted.filter(m => {
      const t = new Date(m.datetime).getTime()
      return t >= sinceTs && t < untilTs
    })
  }, [allMealRows, allReadings, activeRange.since, activeRange.until])

  return (
    <StintContext.Provider value={{
      stints,
      months,
      selectedMonth,
      setSelectedMonth,
      meals,
      loading,
      error,
      hasData: stints.length > 0,
    }}>
      {children}
    </StintContext.Provider>
  )
}

export function useStint() {
  return useContext(StintContext)
}

function expandRangeMonths(startDate, endDate) {
  const out = []
  const [sy, sm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}
