import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const cause = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 max-w-[220px]">
      <p className="text-xs font-semibold text-slate-800 mb-1">{cause.name}</p>
      <div className="space-y-1">
        <p className="text-xs text-slate-600">
          Avg spike: <span className="font-semibold text-red-600">+{cause.avgSpike} mg/dL</span>
        </p>
        <p className="text-xs text-slate-600">
          Frequency: <span className="font-semibold text-slate-800">{cause.frequency}%</span> of episodes
        </p>
      </div>
    </div>
  )
}

function severityColor(severity) {
  if (severity === 'high')   return '#EF4444'
  if (severity === 'medium') return '#F59E0B'
  return '#94A3B8'
}

export default function SpikeBarChart({ data, height = 320 }) {
  const sorted = [...data].sort((a, b) => b.avgSpike - a.avgSpike)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 5, right: 40, bottom: 5, left: 10 }}
        barSize={16}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 80]}
          tick={{ fontSize: 11, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `+${v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fontSize: 11, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
        <Bar dataKey="avgSpike" radius={[0, 6, 6, 0]}>
          {sorted.map((entry, index) => (
            <Cell key={index} fill={severityColor(entry.severity)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
