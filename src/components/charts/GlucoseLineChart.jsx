import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import { formatTime, formatGlucose } from '../../utils/formatters'
import { getGlucoseZone, getZoneColor } from '../../utils/glucoseUtils'

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  const zone = getGlucoseZone(d.value)
  const color = getZoneColor(d.value)
  const zoneLabels = { low: 'Low', normal: 'In Range', elevated: 'Elevated', high: 'High' }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[150px]">
      <p className="text-xs font-semibold text-slate-500 mb-1">{formatTime(d.time)}</p>
      <p className="text-lg font-bold" style={{ color }}>
        {d.value} <span className="text-sm font-normal text-slate-400">mg/dL</span>
      </p>
      <p className="text-xs mt-0.5" style={{ color }}>{zoneLabels[zone]}</p>
      {d.event && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-medium text-slate-600">
            {d.event === 'meal' ? '🍽' : d.event === 'exercise' ? '🏃' : '🍎'} {d.eventLabel}
          </span>
        </div>
      )}
    </div>
  )
}

function CustomDot({ cx, cy, payload }) {
  if (!payload.event) return null
  const colors = { meal: '#3B82F6', exercise: '#22C55E', snack: '#F59E0B' }
  const color = colors[payload.event] || '#6B7280'
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
    </g>
  )
}

// Thin-spaced X-axis ticks (show every 3 hours)
function shouldShowTick(time) {
  const [h, m] = time.split(':').map(Number)
  return m === 0 && h % 3 === 0
}

export default function GlucoseLineChart({ data, height = 280 }) {
  const tickFormatter = (time) => {
    if (!shouldShowTick(time)) return ''
    const [h] = time.split(':').map(Number)
    if (h === 0) return '12a'
    if (h === 12) return '12p'
    return h < 12 ? `${h}a` : `${h - 12}p`
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
        {/* Glucose zones */}
        <ReferenceArea y1={0}   y2={70}  fill="#FEF2F2" fillOpacity={0.6} />
        <ReferenceArea y1={70}  y2={140} fill="#F0FDF4" fillOpacity={0.4} />
        <ReferenceArea y1={140} y2={180} fill="#FFFBEB" fillOpacity={0.6} />
        <ReferenceArea y1={180} y2={220} fill="#FEF2F2" fillOpacity={0.6} />

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#F1F5F9"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[60, 200]}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          tickCount={6}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }} />

        {/* Target range lines */}
        <ReferenceLine y={70}  stroke="#22C55E" strokeDasharray="4 4" strokeWidth={1.5} />
        <ReferenceLine y={140} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1.5} />

        <Line
          type="monotone"
          dataKey="value"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: '#3B82F6', stroke: 'white', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
