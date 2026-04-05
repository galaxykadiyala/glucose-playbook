import { useMemo } from 'react'
import { useGlucoseData } from './useGlucoseData'
import { estimateA1C, getA1CCategory, getVariabilityLabel } from '../utils/glucoseUtils'

export function useStats() {
  const { weekSummary, sampleDayStats } = useGlucoseData()

  const topStats = useMemo(() => {
    const a1c = estimateA1C(weekSummary.avgGlucose)
    const a1cCat = getA1CCategory(a1c)
    const variability = getVariabilityLabel(sampleDayStats.cv || weekSummary.avgVariability)

    return [
      {
        id:        'tir',
        label:     'Time in Range',
        value:     `${weekSummary.timeInRange}%`,
        rawValue:  weekSummary.timeInRange,
        sublabel:  '70–140 mg/dL target',
        trend:     weekSummary.timeInRange >= 70 ? 'good' : 'bad',
        color:     weekSummary.timeInRange >= 70 ? '#22C55E' : '#EF4444',
        bg:        weekSummary.timeInRange >= 70 ? '#F0FDF4' : '#FEF2F2',
      },
      {
        id:        'avg',
        label:     'Avg Glucose',
        value:     `${weekSummary.avgGlucose}`,
        rawValue:  weekSummary.avgGlucose,
        unit:      'mg/dL',
        sublabel:  '7-day average',
        trend:     weekSummary.avgGlucose < 115 ? 'good' : 'warn',
        color:     weekSummary.avgGlucose < 115 ? '#3B82F6' : '#F59E0B',
        bg:        '#EFF6FF',
      },
      {
        id:        'a1c',
        label:     'Estimated A1C',
        value:     `${a1c}%`,
        rawValue:  parseFloat(a1c),
        sublabel:  a1cCat.label,
        trend:     parseFloat(a1c) < 5.7 ? 'good' : parseFloat(a1c) < 6.5 ? 'warn' : 'bad',
        color:     a1cCat.color,
        bg:        parseFloat(a1c) < 5.7 ? '#F0FDF4' : parseFloat(a1c) < 6.5 ? '#FFFBEB' : '#FEF2F2',
      },
      {
        id:        'variability',
        label:     'Glucose Variability',
        value:     `${weekSummary.avgVariability}`,
        rawValue:  weekSummary.avgVariability,
        unit:      'CV%',
        sublabel:  variability.label,
        trend:     weekSummary.avgVariability < 20 ? 'good' : weekSummary.avgVariability < 36 ? 'warn' : 'bad',
        color:     variability.color,
        bg:        weekSummary.avgVariability < 20 ? '#F0FDF4' : weekSummary.avgVariability < 36 ? '#FFFBEB' : '#FEF2F2',
      },
    ]
  }, [weekSummary, sampleDayStats])

  return { topStats, weekSummary }
}
