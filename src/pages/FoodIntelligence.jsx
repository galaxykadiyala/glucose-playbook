import { useState, useMemo } from 'react'
import foodData from '../data/foodData.json'
import FoodImpactChart from '../components/charts/FoodImpactChart'
import Card, { CardHeader } from '../components/ui/Card'
import InsightCard from '../components/cards/InsightCard'
import { getRatingColor, getCategoryColor } from '../utils/formatters'

const RATINGS   = ['All', 'Excellent', 'Good', 'Moderate', 'Avoid']
const SORT_OPTIONS = [
  { value: 'glycemicIndex',   label: 'Glycemic Index' },
  { value: 'avgGlucoseRise',  label: 'Glucose Rise' },
  { value: 'glycemicLoad',    label: 'Glycemic Load' },
]

function FoodRatingBadge({ rating, ratingLabel }) {
  const colors = getRatingColor(rating)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border, border: '1px solid' }}
    >
      {ratingLabel}
    </span>
  )
}

function NutritionPill({ label, value, unit = '' }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}<span className="text-[10px] text-slate-400 ml-0.5">{unit}</span></p>
    </div>
  )
}

function GIBar({ value, max = 100 }) {
  const color = value <= 55 ? '#22C55E' : value <= 70 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-7 text-right" style={{ color }}>{value}</span>
    </div>
  )
}

function FoodCard({ food }) {
  const [expanded, setExpanded] = useState(false)
  const catColor = getCategoryColor(food.category)

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className="w-full text-left bg-white rounded-xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: catColor.bg, color: catColor.text }}
            >
              {food.categoryLabel}
            </span>
            <FoodRatingBadge rating={food.rating} ratingLabel={food.ratingLabel} />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{food.name}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{food.serving}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {food.avgGlucoseRise > 0 ? (
            <>
              <div className="text-xl font-bold text-red-500">+{food.avgGlucoseRise}</div>
              <div className="text-[10px] text-slate-400">mg/dL rise</div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-emerald-600">~0</div>
              <div className="text-[10px] text-slate-400">mg/dL rise</div>
            </>
          )}
        </div>
      </div>

      {/* GI bar */}
      {food.glycemicIndex > 0 && (
        <div className="mb-2">
          <div className="flex justify-between mb-1">
            <span className="text-[11px] text-slate-500">Glycemic Index</span>
            <span className="text-[11px] text-slate-400">
              {food.glycemicIndex <= 55 ? 'Low' : food.glycemicIndex <= 70 ? 'Medium' : 'High'}
            </span>
          </div>
          <GIBar value={food.glycemicIndex} />
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-50">
          {/* Macros */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <NutritionPill label="Carbs"    value={food.carbs}   unit="g" />
            <NutritionPill label="Fiber"    value={food.fiber}   unit="g" />
            <NutritionPill label="Protein"  value={food.protein} unit="g" />
            <NutritionPill label="Fat"      value={food.fat}     unit="g" />
          </div>

          {/* Notes */}
          <p className="text-xs text-slate-600 leading-relaxed mb-2">{food.notes}</p>

          {/* Alternatives */}
          {food.alternatives?.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Better alternatives</p>
              <div className="flex flex-wrap gap-1.5">
                {food.alternatives.map((alt, i) => (
                  <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] rounded-full">
                    {alt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expand hint */}
      <div className="flex justify-end mt-2">
        <span className="text-[10px] text-slate-400">{expanded ? 'Less ▲' : 'Details ▼'}</span>
      </div>
    </button>
  )
}

export default function FoodIntelligence() {
  const [activeRating, setActiveRating] = useState('All')
  const [sortBy, setSortBy] = useState('glycemicIndex')

  const filtered = useMemo(() => {
    let items = activeRating === 'All'
      ? foodData
      : foodData.filter(f => f.ratingLabel === activeRating)
    return [...items].sort((a, b) => b[sortBy] - a[sortBy])
  }, [activeRating, sortBy])

  const bestFoods  = foodData.filter(f => f.rating === 'excellent').slice(0, 4)
  const avoidFoods = foodData.filter(f => f.rating === 'avoid').slice(0, 4)

  const insights = [
    {
      type: 'success',
      title: 'Legumes are the best carbohydrate source',
      body: 'Lentils and chickpeas have GI of 28–29 with high protein and fiber, causing <15 mg/dL glucose rise — half that of "healthy" oatmeal.',
    },
    {
      type: 'danger',
      title: 'Liquid sugars spike faster than any solid food',
      body: 'Soda and OJ peak glucose in 15 minutes — before insulin can even respond. Swapping to sparkling water eliminates this trigger entirely.',
    },
    {
      type: 'info',
      title: 'GI alone is not enough — glycemic load matters',
      body: 'Watermelon has GI 76 but glycemic load of only 8 (small portion = small carb hit). Focus on GL for real-world impact.',
    },
    {
      type: 'warning',
      title: 'Context changes everything',
      body: 'White potato (GI 85) becomes significantly less harmful when cooled and reheated — resistant starch formation drops its GI to ~56.',
    },
  ]

  return (
    <div>
      {/* Chart */}
      <Card className="mb-6" padding={false}>
        <div className="p-5">
          <CardHeader
            title="Glycemic Index vs Glucose Response"
            subtitle="Each dot = one food. Color = rating. X = GI, Y = average glucose rise."
          />
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-1">
            {[
              { color: '#22C55E', label: 'Excellent' },
              { color: '#3B82F6', label: 'Good' },
              { color: '#F59E0B', label: 'Moderate' },
              { color: '#EF4444', label: 'Avoid' },
            ].map((l, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 pb-4">
          <FoodImpactChart data={foodData} height={300} />
        </div>
      </Card>

      {/* Best / Avoid quick lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader title="Best Choices" subtitle="Minimal glucose impact" />
          <div className="space-y-2.5">
            {bestFoods.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-base">
                    {f.category === 'protein' ? '🥩' : f.category === 'legumes' ? '🫘' : f.category === 'dairy' ? '🥛' : f.category === 'fats' ? '🥑' : f.category === 'nuts' ? '🌰' : '🫐'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{f.name}</p>
                    <p className="text-[11px] text-slate-400">GI {f.glycemicIndex}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600">
                  {f.avgGlucoseRise > 0 ? `+${f.avgGlucoseRise}` : '~0'} <span className="font-normal text-slate-400">mg/dL</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Foods to Minimize" subtitle="High glycemic impact" />
          <div className="space-y-2.5">
            {avoidFoods.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-base">
                    {f.category === 'grains' ? '🍞' : f.category === 'beverages' ? '🥤' : f.category === 'vegetables' ? '🥔' : '🍚'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{f.name}</p>
                    <p className="text-[11px] text-slate-400">GI {f.glycemicIndex}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-red-600">
                  +{f.avgGlucoseRise} <span className="font-normal text-slate-400">mg/dL</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Filter + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RATINGS.map(r => (
            <button
              key={r}
              onClick={() => setActiveRating(r)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeRating === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {r} {r !== 'All' && <span className={activeRating === r ? 'text-blue-200' : 'text-slate-400'}>
                {foodData.filter(f => f.ratingLabel === r).length}
              </span>}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>Sort by {o.label}</option>
          ))}
        </select>
      </div>

      {/* Food cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
        {filtered.map(food => (
          <FoodCard key={food.id} food={food} />
        ))}
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
      </div>
    </div>
  )
}
