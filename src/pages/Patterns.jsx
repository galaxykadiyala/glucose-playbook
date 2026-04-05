import { useState } from 'react'
import { useGlucoseData } from '../hooks/useGlucoseData'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import GlucoseLineChart from '../components/charts/GlucoseLineChart'
import Card, { CardHeader } from '../components/ui/Card'
import InsightCard from '../components/cards/InsightCard'

function HourlyAreaChart({ data }) {
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const color = d.avg <= 140 ? '#22C55E' : d.avg <= 180 ? '#F59E0B' : '#EF4444'
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3">
        <p className="text-xs font-semibold text-slate-500">{d.hour}</p>
        <p className="text-base font-bold" style={{ color }}>{d.avg} mg/dL</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} interval={2} />
        <YAxis domain={[70, 170]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={140} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1.5} />
        <ReferenceLine y={70}  stroke="#22C55E" strokeDasharray="4 4" strokeWidth={1.5} />
        <Area
          type="monotone"
          dataKey="avg"
          stroke="#3B82F6"
          strokeWidth={2.5}
          fill="url(#avgGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function WeeklyTIRChart({ data }) {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3">
        <p className="text-xs font-semibold text-slate-700">{d?.label}</p>
        <p className="text-sm font-bold text-emerald-600">{d?.timeInRange}% in range</p>
        <p className="text-xs text-slate-500">Avg: {d?.avgGlucose} mg/dL</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={28} margin={{ top: 5, right: 16, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
        <ReferenceLine y={70} stroke="#22C55E" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '70% target', fontSize: 10, fill: '#22C55E', position: 'right' }} />
        <Bar dataKey="timeInRange" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.timeInRange >= 80 ? '#22C55E' : d.timeInRange >= 70 ? '#F59E0B' : '#EF4444'}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function Patterns() {
  const { sampleDay, weeklyData, hourlyAverages } = useGlucoseData()
  const [selectedDay, setSelectedDay] = useState(6) // Sunday by default

  const currentDay = weeklyData[selectedDay]

  // Build chart-ready readings for selected day from hourly array
  const selectedReadings = currentDay.readings.map((v, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    value: v,
  }))

  const insights = [
    {
      type: 'warning',
      title: 'Post-dinner is your highest-risk window',
      body: 'Average glucose between 7–8 PM is 152 mg/dL — the peak of your day. A post-dinner walk could shift this below 130.',
    },
    {
      type: 'info',
      title: 'Dawn phenomenon detected',
      body: 'Glucose rises from ~81 at 3 AM to ~92 by 6 AM before breakfast. This is a natural cortisol-driven pattern, not a cause for alarm.',
    },
    {
      type: 'success',
      title: 'Wednesday was your best day',
      body: '94% time in range with an average of 95 mg/dL. This was an exercise day with a 45-minute cardio session.',
    },
  ]

  return (
    <div>
      {/* Weekly TIR overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader title="Weekly Time in Range" subtitle="Percentage of readings 70–140 mg/dL per day" />
          <WeeklyTIRChart data={weeklyData} />
        </Card>

        <Card>
          <CardHeader title="Average Glucose by Hour" subtitle="7-day average pattern across the day" />
          <HourlyAreaChart data={hourlyAverages} />
        </Card>
      </div>

      {/* Day selector */}
      <Card padding={false} className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Daily Trace</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select a day to view full glucose trace</p>
          </div>
        </div>

        {/* Day tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {weeklyData.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedDay === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <div>{day.label}</div>
              <div className={`text-[10px] mt-0.5 ${selectedDay === i ? 'text-blue-200' : 'text-slate-400'}`}>
                {day.timeInRange}%
              </div>
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Time in Range', value: `${currentDay.timeInRange}%`, color: currentDay.timeInRange >= 80 ? '#22C55E' : '#F59E0B' },
            { label: 'Average',       value: `${currentDay.avgGlucose}`, unit: 'mg/dL', color: '#3B82F6' },
            { label: 'Max Glucose',   value: `${currentDay.maxGlucose}`, unit: 'mg/dL', color: currentDay.maxGlucose > 180 ? '#EF4444' : '#F59E0B' },
            { label: 'Est. A1C',      value: `${currentDay.estimatedA1c}%`, color: parseFloat(currentDay.estimatedA1c) < 5.7 ? '#22C55E' : '#F59E0B' },
          ].map((s, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
              <p className="text-base font-bold" style={{ color: s.color }}>
                {s.value} {s.unit && <span className="text-xs font-normal text-slate-400">{s.unit}</span>}
              </p>
            </div>
          ))}
        </div>

        <GlucoseLineChart data={selectedReadings} height={240} />
      </Card>

      {/* Pattern breakdown table */}
      <Card className="mb-6">
        <CardHeader title="7-Day Pattern Summary" subtitle="Comparison across all days" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {['Day', 'Avg', 'Min', 'Max', 'TIR', 'Elevated', 'High', 'Est A1C'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((day, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedDay(i)}>
                  <td className="py-2.5 pr-4 font-semibold text-slate-800">{day.label}</td>
                  <td className="py-2.5 pr-4 text-slate-700">{day.avgGlucose}</td>
                  <td className="py-2.5 pr-4 text-slate-700">{day.minGlucose}</td>
                  <td className="py-2.5 pr-4 font-medium" style={{ color: day.maxGlucose > 180 ? '#EF4444' : '#F59E0B' }}>{day.maxGlucose}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`font-semibold ${day.timeInRange >= 80 ? 'text-emerald-600' : day.timeInRange >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {day.timeInRange}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-amber-600">{day.timeElevated}%</td>
                  <td className="py-2.5 pr-4 text-red-600">{day.timeHigh}%</td>
                  <td className="py-2.5 pr-4 text-slate-700">{day.estimatedA1c}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
      </div>
    </div>
  )
}
