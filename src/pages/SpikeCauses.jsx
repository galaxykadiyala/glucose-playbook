import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts'
import cgmData from '../data/cgmData.json'
import { detectCauses, severityMeta, deltaColor } from '../utils/insightsEngine'

// ─── Static cause definitions ─────────────────────────────────────────────────
// spikeIds   → meals that demonstrate the spike pattern for this cause
// controlId  → the controlled-equivalent meal that shows what changes with mitigation

const CAUSE_DEFS = [
  {
    key: 'refined_carb',
    rank: 1,
    title: 'Refined Carbohydrates',
    icon: '🍚',
    color: '#EF4444',
    light: '#FEF2F2',
    border: '#FECACA',
    explanation:
      'White rice, dosa, poori, and idli are made from highly processed starch with little remaining fibre. They break down to glucose within 20–40 minutes — faster than the body can produce a matching insulin response.',
    mechanism:
      'High amylopectin content (vs amylose) means rapid hydrolysis by salivary and pancreatic amylase. Without fibre to form a gel barrier, glucose floods the portal vein before sufficient insulin can be secreted.',
    fix: 'Limit white rice to ½ cup. Pair any refined carb with chia seeds pre-meal and a 10–15 min walk after. Or swap: brown rice (GI 50 vs 73), ragi dosa, or oats.',
    spikeIds:   ['meal_004', 'meal_010', 'meal_011'],
    controlId:  'meal_015',
    controlNote: 'Same white rice — chia seeds + 15 min walk brought peak 35 mg/dL lower with no spike.',
  },
  {
    key: 'no_activity',
    rank: 2,
    title: 'No Post-Meal Movement',
    icon: '🪑',
    color: '#F97316',
    light: '#FFF7ED',
    border: '#FED7AA',
    explanation:
      'Sitting still after a carb-heavy meal lets glucose build up unchecked in the bloodstream. Muscle movement activates GLUT4 transporters — special glucose doors that open without insulin — and can absorb 30–40% of the meal\'s glucose load independently.',
    mechanism:
      'Skeletal muscle contraction triggers AMPK and GLUT4 translocation to the cell membrane within minutes of starting movement. This insulin-independent uptake is the fastest natural glucose disposal mechanism available post-meal.',
    fix: 'Walk for 10–15 minutes starting within 30 minutes of finishing a meal. Even slow walking works — intensity matters less than simply moving.',
    spikeIds:   ['meal_007', 'meal_016'],
    controlId:  'meal_005',
    controlNote: 'Identical brown rice meal — adding a 15 min walk cut the peak by 15 mg/dL and prevented the spike.',
  },
  {
    key: 'no_fiber',
    rank: 3,
    title: 'Lack of Fibre',
    icon: '🥬',
    color: '#8B5CF6',
    light: '#F5F3FF',
    border: '#DDD6FE',
    explanation:
      'Meals without fibre-rich vegetables, legumes, or a fibre supplement (chia/methi) have nothing to slow glucose absorption. Fibre creates a physical gel in the gut that forces digestion to slow down, effectively lowering the glycemic index of everything else in the meal.',
    mechanism:
      'Soluble fibre (from chia, methi, okra, legumes) forms a viscous matrix that increases intestinal transit time and reduces the rate of glucose diffusion across the intestinal wall. It also ferments in the colon, producing short-chain fatty acids that improve insulin sensitivity.',
    fix: 'Add chia seeds or methi seeds pre-meal, or start the meal with a fibre-rich vegetable (salad, cucumber, carrot). Even ½ cup of dal alongside rice significantly blunts the spike.',
    spikeIds:   ['meal_010', 'meal_011'],
    controlId:  'meal_003',
    controlNote: 'Brown rice + greens + mushroom curry — the vegetable fibre brought peak down to 126, delta just 28 mg/dL.',
  },
  {
    key: 'fat_carb_combo',
    rank: 4,
    title: 'Fat + Carb Combination',
    icon: '🧈',
    color: '#F59E0B',
    light: '#FFFBEB',
    border: '#FDE68A',
    explanation:
      'Fat-heavy dishes (biryani, cashew curry, fried foods) paired with carbohydrates create a deceptive effect: fat initially slows the glucose rise but prolongs the total time spent elevated. The overall glucose area under the curve is often higher than a plain carb meal.',
    mechanism:
      'Dietary fat delays gastric emptying (via cholecystokinin release), which shifts the glucose peak to 45–60 minutes instead of 30 minutes. However, fat also reduces insulin sensitivity acutely, meaning less glucose is cleared per unit of insulin, resulting in a larger total excursion.',
    fix: 'Avoid combining fried/fatty foods with refined carbs. If eating biryani or cashew-based curries, apply chia seeds pre-meal and walk for at least 15 minutes after.',
    spikeIds:   ['meal_013', 'meal_001'],
    controlId:  null,
    controlNote: null,
  },
]

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useCauses() {
  return useMemo(() => {
    const meals = cgmData.meals
    const spikedMeals = meals.filter(m => m.spike)

    return CAUSE_DEFS.map(def => {
      const matchedSpikes = spikedMeals.filter(m =>
        detectCauses(m).some(c => c.key === def.key)
      )
      const frequency = Math.round((matchedSpikes.length / spikedMeals.length) * 100)
      const avgDelta = matchedSpikes.length
        ? Math.round(matchedSpikes.reduce((s, m) => s + m.glucose.delta, 0) / matchedSpikes.length)
        : 0

      return {
        ...def,
        frequency,
        mealCount:     matchedSpikes.length,
        avgDelta,
        spikedMeals:   def.spikeIds.map(id => meals.find(m => m.id === id)).filter(Boolean),
        controlledMeal: def.controlId ? meals.find(m => m.id === def.controlId) : null,
      }
    })
  }, [])
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ readings, spiked }) {
  return (
    <ResponsiveContainer width="100%" height={52}>
      <LineChart data={readings} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <ReferenceLine y={140} stroke={spiked ? '#FCA5A5' : '#6EE7B7'} strokeDasharray="3 2" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={spiked ? '#EF4444' : '#22C55E'}
          strokeWidth={1.8}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Meal example card ────────────────────────────────────────────────────────

function MealCard({ meal, variant = 'spike' }) {
  const isSpike      = variant === 'spike'
  const isControlled = variant === 'controlled'
  const sev = severityMeta(meal.spike_severity || (meal.spike ? 'mild' : 'none'))
  const dColor = deltaColor(meal.glucose.delta)

  const cardStyle = isControlled
    ? 'bg-emerald-50/70 border border-emerald-200'
    : 'bg-slate-50 border border-slate-200'

  return (
    <div className={`rounded-xl p-3 ${cardStyle}`}>
      <div className="flex items-start gap-3">

        {/* Left: foods + stats */}
        <div className="flex-1 min-w-0">
          {/* Food badges */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            {meal.foods.map((f, i) => (
              <span
                key={i}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  isControlled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                {f.name}
              </span>
            ))}
          </div>

          {/* Stat row */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-tight">Peak</p>
              <p className="text-base font-bold" style={{ color: isSpike ? sev.color : '#22C55E' }}>
                {meal.glucose.peak}
                <span className="text-[10px] font-normal text-slate-400 ml-0.5">mg/dL</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-tight">Rise</p>
              <p className="text-base font-bold" style={{ color: dColor }}>+{meal.glucose.delta}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-tight">Start</p>
              <p className="text-base font-bold text-slate-600">{meal.glucose.baseline}</p>
            </div>
            <div className="ml-auto">
              {isSpike ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: sev.bg, color: sev.color }}
                >
                  {sev.label} Spike
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                  Controlled ✓
                </span>
              )}
            </div>
          </div>

          {/* Strategy pills */}
          {(meal.pre_meal?.length > 0 || meal.post_meal?.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {meal.pre_meal?.map((p, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-medium">
                  Pre: {p.item || p}
                </span>
              ))}
              {meal.post_meal?.map((p, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-medium">
                  Post: {p.activity || p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: sparkline */}
        <div className="w-24 flex-shrink-0">
          <Sparkline readings={meal.glucose.readings} spiked={isSpike} />
          <p className="text-[10px] text-slate-400 text-center mt-0.5">0 → 120 min</p>
        </div>
      </div>
    </div>
  )
}

// ─── Cause section ────────────────────────────────────────────────────────────

function CauseSection({ cause }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden mb-5">
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: cause.color }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">

        {/* ── Left panel: cause info ── */}
        <div
          className="lg:col-span-1 p-5 border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: cause.border }}
        >
          {/* Rank + title */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: cause.light }}
            >
              {cause.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: cause.light, color: cause.color }}
                >
                  #{cause.rank}
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">{cause.title}</h2>
            </div>
          </div>

          {/* Stats chips */}
          <div className="flex gap-2 mb-4">
            <div
              className="flex-1 rounded-xl p-2.5 text-center"
              style={{ backgroundColor: cause.light }}
            >
              <p className="text-xl font-bold" style={{ color: cause.color }}>{cause.frequency}%</p>
              <p className="text-[10px] text-slate-500 mt-0.5">of spikes</p>
            </div>
            <div className="flex-1 rounded-xl p-2.5 text-center bg-slate-50">
              <p className="text-xl font-bold text-slate-800">+{cause.avgDelta}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">avg rise</p>
            </div>
            <div className="flex-1 rounded-xl p-2.5 text-center bg-slate-50">
              <p className="text-xl font-bold text-slate-800">{cause.mealCount}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">meals</p>
            </div>
          </div>

          {/* Explanation */}
          <p className="text-xs text-slate-700 leading-relaxed mb-3">{cause.explanation}</p>

          {/* Mechanism */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Why it happens</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">{cause.mechanism}</p>
          </div>

          {/* Fix */}
          <div
            className="rounded-lg p-3"
            style={{ backgroundColor: cause.light, borderColor: cause.border }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: cause.color }}>
              What to do
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: cause.color }}>{cause.fix}</p>
          </div>
        </div>

        {/* ── Right panel: meal examples ── */}
        <div className="lg:col-span-2 p-5">

          {/* Spike examples */}
          <div className="mb-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <p className="text-xs font-semibold text-slate-700">Spike examples from your meals</p>
            </div>
            <div className="space-y-2.5">
              {cause.spikedMeals.map(meal => (
                <MealCard key={meal.id} meal={meal} variant="spike" />
              ))}
            </div>
          </div>

          {/* Controlled comparison */}
          {cause.controlledMeal && (
            <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <p className="text-xs font-semibold text-emerald-700">Controlled comparison</p>
              </div>
              <MealCard meal={cause.controlledMeal} variant="controlled" />
              <p className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-relaxed">
                {cause.controlNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Ranking overview bar ─────────────────────────────────────────────────────

function RankingBar({ causes }) {
  const max = Math.max(...causes.map(c => c.frequency))
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Causes Ranked by Frequency</h2>
          <p className="text-xs text-slate-400 mt-0.5">% of your {cgmData.meals.filter(m=>m.spike).length} spike events where each cause was active</p>
        </div>
        <span className="text-xs text-slate-400">{cgmData.meals.length} meals analysed</span>
      </div>
      <div className="space-y-3">
        {causes.map(c => (
          <div key={c.key} className="flex items-center gap-4">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-sm flex-shrink-0"
              style={{ backgroundColor: c.light }}>
              {c.icon}
            </div>
            <span className="text-xs font-medium text-slate-700 w-44 flex-shrink-0">{c.title}</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(c.frequency / max) * 100}%`, backgroundColor: c.color }}
                />
              </div>
              <span className="text-xs font-bold w-8 text-right" style={{ color: c.color }}>
                {c.frequency}%
              </span>
            </div>
            <div className="text-right flex-shrink-0 w-20">
              <span className="text-xs font-semibold text-slate-700">+{c.avgDelta} avg</span>
              <span className="text-[10px] text-slate-400 ml-1">Δ</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryStats({ causes }) {
  const meals      = cgmData.meals
  const spiked     = meals.filter(m => m.spike)
  const topCause   = causes[0]
  const worstMeal  = [...spiked].sort((a, b) => b.glucose.delta - a.glucose.delta)[0]

  const stats = [
    {
      label: 'Total Spikes',
      value: spiked.length,
      unit: `/ ${meals.length} meals`,
      color: '#EF4444',
      bg: '#FEF2F2',
    },
    {
      label: 'Most Common Cause',
      value: topCause.frequency + '%',
      unit: topCause.title,
      color: topCause.color,
      bg: topCause.light,
    },
    {
      label: 'Highest Delta',
      value: '+' + worstMeal.glucose.delta,
      unit: worstMeal.foods[0]?.name || '',
      color: '#F97316',
      bg: '#FFF7ED',
    },
    {
      label: 'Causes Identified',
      value: causes.length,
      unit: 'distinct patterns',
      color: '#8B5CF6',
      bg: '#F5F3FF',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{s.label}</p>
          <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{s.unit}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpikeCauses() {
  const causes = useCauses()

  return (
    <div>
      <SummaryStats causes={causes} />
      <RankingBar causes={causes} />
      {causes.map(cause => (
        <CauseSection key={cause.key} cause={cause} />
      ))}
    </div>
  )
}
