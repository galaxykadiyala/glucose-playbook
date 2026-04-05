import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ZAxis,
} from 'recharts'
import { getRatingColor } from '../../utils/formatters'

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  const ratingColor = getRatingColor(d.rating)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[170px]">
      <p className="text-sm font-semibold text-slate-900 mb-1">{d.name}</p>
      <div className="space-y-0.5 text-xs">
        <p className="text-slate-600">GI: <span className="font-semibold text-slate-800">{d.glycemicIndex}</span></p>
        <p className="text-slate-600">
          Glucose rise: <span className="font-semibold text-red-600">+{d.avgGlucoseRise} mg/dL</span>
        </p>
        <p className="text-slate-600">Category: <span className="font-medium">{d.categoryLabel}</span></p>
      </div>
      <span
        className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{ backgroundColor: ratingColor.bg, color: ratingColor.text }}
      >
        {d.ratingLabel}
      </span>
    </div>
  )
}

function ratingToColor(rating) {
  const map = {
    excellent: '#22C55E',
    good:      '#3B82F6',
    moderate:  '#F59E0B',
    avoid:     '#EF4444',
  }
  return map[rating] || '#94A3B8'
}

export default function FoodImpactChart({ data, height = 320 }) {
  const plotData = data.filter(d => d.glycemicIndex > 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis
          type="number"
          dataKey="glycemicIndex"
          domain={[0, 100]}
          name="Glycemic Index"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Glycemic Index', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94A3B8' }}
        />
        <YAxis
          type="number"
          dataKey="avgGlucoseRise"
          name="Glucose Rise"
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `+${v}`}
          label={{ value: 'Glucose Rise', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#94A3B8' }}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <ReferenceLine x={55}  stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'GI 55', fontSize: 10, fill: '#F59E0B', position: 'top' }} />
        <ReferenceLine y={30} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: '+30', fontSize: 10, fill: '#F59E0B', position: 'right' }} />
        <Scatter
          data={plotData}
          fill="#3B82F6"
          shape={(props) => {
            const { cx, cy, payload } = props
            const color = ratingToColor(payload.rating)
            return (
              <g>
                <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.8} stroke="white" strokeWidth={1.5} />
              </g>
            )
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
