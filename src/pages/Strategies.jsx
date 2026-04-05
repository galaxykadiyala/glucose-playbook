import { useState } from 'react'
import strategies from '../data/strategies.json'
import StrategyCard from '../components/cards/StrategyCard'
import Card, { CardHeader } from '../components/ui/Card'
import InsightCard from '../components/cards/InsightCard'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from 'recharts'

const CATEGORIES = ['All', 'Exercise', 'Diet', 'Lifestyle', 'Supplement']

function EffectivenessRadar({ data }) {
  const radarData = data.slice(0, 6).map(s => ({
    name: s.name.split(' ').slice(0, 2).join(' '),
    value: s.effectiveness,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="#E2E8F0" />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} />
        <Radar
          dataKey="value"
          stroke="#3B82F6"
          fill="#3B82F6"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Effectiveness']}
          contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: 12 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function SortBar({ topStrategies }) {
  return (
    <div className="space-y-2.5">
      {topStrategies.map((s, i) => {
        const color = s.effectiveness >= 85 ? '#22C55E' : s.effectiveness >= 70 ? '#3B82F6' : '#F59E0B'
        return (
          <div key={s.id} className="flex items-center gap-3">
            <span className="w-5 text-xs text-slate-400 font-mono text-right flex-shrink-0">{i + 1}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-700">{s.name}</span>
                <span className="text-xs font-bold" style={{ color }}>{s.effectiveness}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${s.effectiveness}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Strategies() {
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = activeCategory === 'All'
    ? strategies
    : strategies.filter(s => s.categoryLabel === activeCategory)

  const sortedByEffectiveness = [...strategies].sort((a, b) => b.effectiveness - a.effectiveness)

  const insights = [
    {
      type: 'success',
      title: 'Exercise strategies dominate the top 2 spots',
      body: 'Post-meal walking (92%) and resistance training (90%) outperform dietary changes alone, because muscle activity works independently of insulin.',
    },
    {
      type: 'info',
      title: 'Combining strategies multiplies the effect',
      body: 'Post-meal walking + protein-first eating together reduce post-meal spikes by ~50% — significantly more than either approach alone.',
    },
    {
      type: 'warning',
      title: 'Supplements have the weakest evidence',
      body: 'ACV and cold exposure show real but modest benefits. Treat them as additions to the foundation (exercise, diet, sleep) — not replacements.',
    },
  ]

  return (
    <div>
      {/* Overview row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader title="Effectiveness Rankings" subtitle="All strategies sorted by clinical evidence" />
          <SortBar topStrategies={sortedByEffectiveness} />
        </Card>

        <Card>
          <CardHeader title="Strategy Profile" subtitle="Top 6 strategies by effectiveness" />
          <EffectivenessRadar data={sortedByEffectiveness.slice(0, 6)} />
        </Card>
      </div>

      {/* Quick stat row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Strategies', value: strategies.length, color: '#3B82F6' },
          { label: 'Strong Evidence', value: strategies.filter(s => s.evidence === 'strong').length, color: '#22C55E' },
          { label: 'Avg Effectiveness', value: `${Math.round(strategies.reduce((s, a) => s + a.effectiveness, 0) / strategies.length)}%`, color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-card">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {cat}
            <span className={`ml-1.5 ${activeCategory === cat ? 'text-blue-200' : 'text-slate-400'}`}>
              {cat === 'All' ? strategies.length : strategies.filter(s => s.categoryLabel === cat).length}
            </span>
          </button>
        ))}
      </div>

      {/* Strategy cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {filtered.map(strategy => (
          <StrategyCard key={strategy.id} strategy={strategy} />
        ))}
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
      </div>
    </div>
  )
}
