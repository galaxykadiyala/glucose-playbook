/**
 * insightsEngine.js
 * Analyses CGM meal data to detect spike causes, identify stabilisers,
 * classify foods, and generate structured insights for UI consumption.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const SPIKE_THRESHOLD     = 140  // mg/dL — above this = spike
export const BORDERLINE_THRESHOLD = 135  // mg/dL — caution zone
export const DELTA_THRESHOLDS = { low: 30, moderate: 50, high: 65 }

/** GI bands (standard ADA classifications) */
export const GI_BANDS = {
  LOW:    { max: 55,       label: 'Low GI',    color: '#22C55E' },
  MEDIUM: { max: 70,       label: 'Medium GI', color: '#F59E0B' },
  HIGH:   { max: Infinity, label: 'High GI',   color: '#EF4444' },
}

/** Food-risk classification thresholds */
const FOOD_RISK = {
  safe:     { maxGI: 40,  label: 'Safe',     color: '#22C55E', bg: '#F0FDF4' },
  moderate: { maxGI: 65,  label: 'Moderate', color: '#F59E0B', bg: '#FFFBEB' },
  risky:    { maxGI: 999, label: 'Risky',    color: '#EF4444', bg: '#FEF2F2' },
}

// ─── Spike Detection ──────────────────────────────────────────────────────────

/**
 * Returns true if a meal crossed the spike threshold.
 * Respects the explicit `spike` flag from the data, but also recomputes from
 * glucose values so the engine stays correct after future data edits.
 */
export function isSpiked(meal) {
  return meal.spike === true || meal.glucose.peak > SPIKE_THRESHOLD
}

/**
 * Classifies spike severity from peak glucose.
 * @returns {'none'|'mild'|'moderate'|'high'|'very_high'}
 */
export function getSpikeseverity(peak) {
  if (peak <= 140) return 'none'
  if (peak <= 155) return 'mild'
  if (peak <= 170) return 'moderate'
  if (peak <= 185) return 'high'
  return 'very_high'
}

/**
 * Returns a human-readable label and colour for a severity string.
 */
export function severityMeta(severity) {
  const map = {
    none:      { label: 'No Spike',   color: '#22C55E', bg: '#F0FDF4' },
    mild:      { label: 'Mild',       color: '#F59E0B', bg: '#FFFBEB' },
    moderate:  { label: 'Moderate',   color: '#F97316', bg: '#FFF7ED' },
    high:      { label: 'High',       color: '#EF4444', bg: '#FEF2F2' },
    very_high: { label: 'Very High',  color: '#DC2626', bg: '#FEF2F2' },
  }
  return map[severity] || map.none
}

// ─── Cause Detection ──────────────────────────────────────────────────────────

/**
 * Keyword maps — each entry is { keywords, label, key, severity, tip }
 * Matched against meal.foods[*].name (lower-case) and meal.tags.
 */
const CAUSE_RULES = [
  {
    key: 'refined_carb',
    label: 'Refined Carbohydrates',
    severity: 'high',
    foodKeywords: ['white rice', 'dosa', 'idli', 'poori', 'puri', 'maida', 'toast', 'bread', 'naan'],
    tagKeywords:  ['refined_carb'],
    tip: 'Swap to brown rice, oats, or ragi. Limit idli to 2 pieces. Toast with whole-grain bread.',
  },
  {
    key: 'fat_carb_combo',
    label: 'Fat + Carb Combination',
    severity: 'medium',
    foodKeywords: ['biryani', 'cashew', 'butter', 'ghee', 'poori', 'puri', 'fried'],
    tagKeywords:  ['fat_carb_combo', 'fried_carb'],
    tip: 'Fat slows but amplifies the total glucose area. Add chia seeds pre-meal and walk after.',
  },
  {
    key: 'no_fiber',
    label: 'Insufficient Fiber',
    severity: 'high',
    foodKeywords: [],
    tagKeywords:  ['no_fiber', 'high_carb'],
    fiberTest: (meal) => {
      const hasHighFiber = meal.foods.some(f =>
        /greens?|salad|vegetable|carrot|cucumber|lentil|dal|spinach|broccoli|beans|chickpea/i.test(f.name)
      )
      const hasFiberPre = meal.pre_meal.some(p =>
        /chia|methi|flax|psyllium|carrot/i.test(p.item || p)
      )
      return !hasHighFiber && !hasFiberPre
    },
    tip: 'Add a vegetable starter, chia seeds pre-meal, or include a fibre-dense side (dal, salad).',
  },
  {
    key: 'no_activity',
    label: 'No Post-Meal Activity',
    severity: 'medium',
    foodKeywords: [],
    tagKeywords:  ['no_activity'],
    activityTest: (meal) => meal.post_meal.length === 0,
    tip: 'A 10–15 min walk after eating activates GLUT4 and reduces peak by 20–30 mg/dL.',
  },
  {
    key: 'high_gi_food',
    label: 'High-GI Food (GI > 70)',
    severity: 'high',
    foodKeywords: ['white rice', 'poori', 'puri', 'jalebi', 'kala jamun'],
    tagKeywords:  [],
    giTest: (meal) => meal.foods.some(f => (f.gi_estimate || 0) > 70),
    tip: 'Use low-GI substitutes or stack strategies: chia + protein-first + walk.',
  },
  {
    key: 'large_portion',
    label: 'Large Portion Size',
    severity: 'high',
    foodKeywords: ['6 idli', '6 idlis'],
    tagKeywords:  ['high_rice'],
    tip: 'Reduce portion: ≤2 idlis, ½ cup rice. Even safe foods spike at large volumes.',
  },
  {
    key: 'elevated_baseline',
    label: 'Elevated Pre-Meal Baseline',
    severity: 'medium',
    foodKeywords: [],
    tagKeywords:  [],
    baselineTest: (meal) => meal.glucose.baseline >= 100,
    tip: 'Baseline ≥100 mg/dL amplifies every subsequent spike. Gap meals by 4+ hours. Walk before eating.',
  },
  {
    key: 'sweet_food',
    label: 'High-Sugar Sweet / Dessert',
    severity: 'high',
    foodKeywords: ['payesh', 'kheer', 'jamun', 'jalebi', 'rabdi', 'sweet', 'gulab'],
    tagKeywords:  ['sweets', 'controlled_sweets'],
    tip: 'Pair sweets with protein (yogurt, nuts) to buffer absorption. Walk immediately after.',
  },
]

/**
 * Identifies all spike causes for a meal.
 * Returns an array of cause objects: { key, label, severity, tip }.
 */
export function detectCauses(meal) {
  if (!isSpiked(meal)) return []

  const foodNames = meal.foods.map(f => (f.name || f).toLowerCase())
  const tags      = meal.tags || []
  const causes    = []

  for (const rule of CAUSE_RULES) {
    let matched = false

    // Keyword match against food names
    if (rule.foodKeywords?.some(kw => foodNames.some(n => n.includes(kw)))) matched = true

    // Keyword match against tags
    if (!matched && rule.tagKeywords?.some(t => tags.includes(t))) matched = true

    // Custom predicate checks
    if (!matched && rule.fiberTest?.(meal))    matched = true
    if (!matched && rule.activityTest?.(meal)) matched = true
    if (!matched && rule.giTest?.(meal))       matched = true
    if (!matched && rule.baselineTest?.(meal)) matched = true

    if (matched) {
      causes.push({ key: rule.key, label: rule.label, severity: rule.severity, tip: rule.tip })
    }
  }

  // Deduplicate by key
  return causes.filter((c, i, arr) => arr.findIndex(x => x.key === c.key) === i)
}

// ─── Stabiliser Detection ─────────────────────────────────────────────────────

const STABILISER_RULES = [
  {
    key: 'chia_seeds',
    label: 'Chia Seeds',
    type: 'supplement',
    mechanism: 'Forms a viscous gel that slows gastric emptying, reducing glucose absorption rate.',
    effect: 'Delays time-to-peak by ~15 min; reduces delta by ~15–20 mg/dL on average.',
    test: (meal) => meal.pre_meal.some(p => /chia/i.test(p.item || p)),
  },
  {
    key: 'methi_seeds',
    label: 'Methi (Fenugreek) Seeds',
    type: 'supplement',
    mechanism: 'Galactomannan fibre inhibits alpha-glucosidase, slowing starch breakdown in the gut.',
    effect: 'Comparable to chia; also improves insulin sensitivity with regular use.',
    test: (meal) => meal.pre_meal.some(p => /methi|fenugreek/i.test(p.item || p)),
  },
  {
    key: 'post_meal_walk',
    label: 'Post-Meal Walk',
    type: 'exercise',
    mechanism: 'Muscle contractions activate GLUT4 transporters, enabling insulin-independent glucose uptake.',
    effect: 'Reduces peak by 20–30 mg/dL; accelerates return to baseline by 25–35 min.',
    test: (meal) => meal.post_meal.some(p => /walk/i.test(p.activity || p)),
  },
  {
    key: 'post_meal_cycling',
    label: 'Post-Meal Cycling',
    type: 'exercise',
    mechanism: 'Higher muscle recruitment than walking; more effective glucose disposal per minute.',
    effect: 'Faster glucose clearance than walking for the same duration.',
    test: (meal) => meal.post_meal.some(p => /cycl/i.test(p.activity || p)),
  },
  {
    key: 'pre_meal_exercise',
    label: 'Pre-Meal Exercise',
    type: 'exercise',
    mechanism: 'Increases muscle insulin sensitivity for 24–48 hours; lowers fasting glucose.',
    effect: 'Lowers baseline before eating; sustained GLUT4 upregulation during the meal.',
    test: (meal) => meal.pre_meal.some(p => /walk|run|jog|gym|exercise|km/i.test(p.item || p)),
  },
  {
    key: 'protein_present',
    label: 'Protein in Meal',
    type: 'dietary',
    mechanism: 'Protein stimulates GLP-1 and GIP secretion, slowing gastric emptying and enhancing insulin response.',
    effect: 'Reduces peak by 15–25 mg/dL when protein is eaten before or alongside carbs.',
    test: (meal) => meal.foods.some(f =>
      /egg|chicken|fish|paneer|curd|yogurt|dal|lentil|tofu|meat|prawn|mutton/i.test(f.name || f)
    ),
  },
  {
    key: 'fiber_rich_side',
    label: 'Fiber-Rich Vegetables / Greens',
    type: 'dietary',
    mechanism: 'Soluble fibre forms a viscous layer slowing glucose absorption; insoluble fibre feeds the microbiome.',
    effect: 'Reduces effective glycemic index of the entire meal.',
    test: (meal) => meal.foods.some(f =>
      /green|salad|vegetable|carrot|cucumber|spinach|broccoli|beans|amaranth|sabji/i.test(f.name || f)
    ),
  },
  {
    key: 'vegetable_primer',
    label: 'Vegetable / Fiber Primer Pre-Meal',
    type: 'dietary',
    mechanism: 'Eating vegetables before carbs creates a physical fiber barrier in the gut.',
    effect: 'Reduces peak by up to 30% for the subsequent carbohydrate load.',
    test: (meal) => meal.pre_meal.some(p => /carrot|salad|vegetable|cucumber/i.test(p.item || p)),
  },
]

/**
 * Returns all active stabilisers for a meal.
 * Includes stabilisers even in non-spike meals — they're what made it controlled.
 */
export function detectStabilisers(meal) {
  return STABILISER_RULES
    .filter(rule => rule.test(meal))
    .map(({ key, label, type, mechanism, effect }) => ({ key, label, type, mechanism, effect }))
}

// ─── Food Classification ──────────────────────────────────────────────────────

/**
 * Classifies a single food item by GI estimate.
 * @returns {{ rating: 'safe'|'moderate'|'risky', label, color, bg, gi }}
 */
export function classifyFood(food) {
  const gi = typeof food === 'object' ? (food.gi_estimate ?? food.gi ?? 0) : 0
  const name = typeof food === 'object' ? food.name : food

  if (gi === 0) {
    // Zero-GI foods (pure protein / fat) are always safe
    return { name, gi, rating: 'safe', ...FOOD_RISK.safe }
  }
  if (gi <= FOOD_RISK.safe.maxGI)     return { name, gi, rating: 'safe',     ...FOOD_RISK.safe     }
  if (gi <= FOOD_RISK.moderate.maxGI) return { name, gi, rating: 'moderate', ...FOOD_RISK.moderate }
  return                                     { name, gi, rating: 'risky',    ...FOOD_RISK.risky    }
}

/**
 * Classifies all foods in a meal and returns the worst-case meal-level risk.
 */
export function classifyMealFoods(meal) {
  const classified = meal.foods.map(classifyFood)
  const order = { safe: 0, moderate: 1, risky: 2 }
  const worst = classified.reduce((max, f) =>
    order[f.rating] > order[max.rating] ? f : max, classified[0]
  )
  return { foods: classified, worstCase: worst }
}

/**
 * Aggregates food-level risk across an entire dataset.
 * Returns a map: food name → { name, gi, rating, color, appearsIn, avgDelta }
 */
export function buildFoodRiskMap(meals) {
  const map = {}

  for (const meal of meals) {
    for (const food of meal.foods) {
      const name = (food.name || food).toLowerCase().trim()
      if (!map[name]) {
        map[name] = {
          ...classifyFood(food),
          name:      food.name || food,
          appearsIn: [],
          totalDelta: 0,
          count:      0,
        }
      }
      map[name].appearsIn.push(meal.id)
      map[name].totalDelta += meal.glucose.delta
      map[name].count++
    }
  }

  // Compute average delta per food
  for (const key of Object.keys(map)) {
    map[key].avgDelta = Math.round(map[key].totalDelta / map[key].count)
  }

  return map
}

// ─── Pattern Analysis ─────────────────────────────────────────────────────────

/**
 * Groups meals by any dimension: day_of_week, meal_type, spike, etc.
 */
export function groupBy(meals, key) {
  return meals.reduce((acc, meal) => {
    const val = String(meal[key] ?? 'unknown')
    if (!acc[val]) acc[val] = []
    acc[val].push(meal)
    return acc
  }, {})
}

/**
 * Computes aggregate statistics for an array of meals.
 */
export function mealStats(meals) {
  if (!meals || meals.length === 0) return null
  const peaks   = meals.map(m => m.glucose.peak)
  const deltas  = meals.map(m => m.glucose.delta)
  const baselines = meals.map(m => m.glucose.baseline)
  const avg     = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  const max     = (arr) => Math.max(...arr)
  const min     = (arr) => Math.min(...arr)

  return {
    count:        meals.length,
    spikeCount:   meals.filter(m => m.spike).length,
    spikeRate:    Math.round((meals.filter(m => m.spike).length / meals.length) * 100),
    avgPeak:      avg(peaks),
    maxPeak:      max(peaks),
    minPeak:      min(peaks),
    avgDelta:     avg(deltas),
    maxDelta:     max(deltas),
    minDelta:     min(deltas),
    avgBaseline:  avg(baselines),
  }
}

/**
 * Detects cross-meal patterns and returns an array of pattern insights.
 * Each insight: { type, title, body, evidence, meals }
 */
export function detectPatterns(meals) {
  const patterns = []

  // ── 1. Strategy absence = 100% spike rate ──
  const noStrategyMeals = meals.filter(m =>
    m.pre_meal.length === 0 && m.post_meal.length === 0
  )
  const noStrategySpikes = noStrategyMeals.filter(m => m.spike)
  if (noStrategyMeals.length >= 3) {
    const rate = Math.round((noStrategySpikes.length / noStrategyMeals.length) * 100)
    patterns.push({
      type:     'danger',
      title:    'Zero-strategy meals spike every time',
      body:     `${noStrategySpikes.length} of ${noStrategyMeals.length} meals with no pre or post-meal strategy resulted in a spike (${rate}%). Even a single intervention cuts this rate significantly.`,
      evidence: noStrategyMeals.map(m => m.id),
    })
  }

  // ── 2. Post-meal walk impact ──
  const withWalk    = meals.filter(m => m.post_meal.some(p => /walk|cycl/i.test(p.activity || p)))
  const withoutWalk = meals.filter(m => m.post_meal.length === 0)
  if (withWalk.length >= 3 && withoutWalk.length >= 3) {
    const walkStats    = mealStats(withWalk)
    const noWalkStats  = mealStats(withoutWalk)
    const diff = noWalkStats.avgPeak - walkStats.avgPeak
    if (diff > 5) {
      patterns.push({
        type:     'success',
        title:    'Post-meal activity lowers glucose by ' + diff + ' mg/dL on average',
        body:     `Avg peak with post-meal activity: ${walkStats.avgPeak} mg/dL (spike rate ${walkStats.spikeRate}%). Without activity: ${noWalkStats.avgPeak} mg/dL (spike rate ${noWalkStats.spikeRate}%). Most impactful single change.`,
        evidence: withWalk.map(m => m.id),
      })
    }
  }

  // ── 3. Chia seeds delay and blunt peaks ──
  const withChia    = meals.filter(m => m.pre_meal.some(p => /chia/i.test(p.item || p)))
  const withoutChia = meals.filter(m => !m.pre_meal.some(p => /chia|methi/i.test(p.item || p)) && m.pre_meal.length === 0)
  if (withChia.length >= 3 && withoutChia.length >= 3) {
    const chiaStats  = mealStats(withChia)
    const noFiberStats = mealStats(withoutChia)
    patterns.push({
      type:     'info',
      title:    'Chia seeds reduce spike rate from ' + noFiberStats.spikeRate + '% to ' + chiaStats.spikeRate + '%',
      body:     `Meals with chia seeds: avg peak ${chiaStats.avgPeak} mg/dL, spike rate ${chiaStats.spikeRate}%. Meals without any pre-meal fiber supplement: avg peak ${noFiberStats.avgPeak} mg/dL, spike rate ${noFiberStats.spikeRate}%.`,
      evidence: withChia.map(m => m.id),
    })
  }

  // ── 4. Idli portion size ──
  const idliMeals = meals.filter(m =>
    m.foods.some(f => /idli/i.test(f.name || f))
  )
  if (idliMeals.length >= 2) {
    const allSpiked = idliMeals.filter(m => m.spike)
    patterns.push({
      type: allSpiked.length === idliMeals.length ? 'danger' : 'warning',
      title: `Idli spiked in ${allSpiked.length} of ${idliMeals.length} meals`,
      body: `Idli is a consistent trigger regardless of protein pairing. Max safe portion appears to be 2 pieces with chia seeds + post-meal walk. ${allSpiked.length === idliMeals.length ? 'All idli meals resulted in a spike.' : 'Controlled when portion is reduced to 2 pieces.'}`,
      evidence: idliMeals.map(m => m.id),
    })
  }

  // ── 5. Elevated baseline amplification ──
  const highBaseline = meals.filter(m => m.glucose.baseline >= 100)
  const lowBaseline  = meals.filter(m => m.glucose.baseline < 100)
  if (highBaseline.length >= 3 && lowBaseline.length >= 3) {
    const hStats = mealStats(highBaseline)
    const lStats = mealStats(lowBaseline)
    if (hStats.spikeRate > lStats.spikeRate + 10) {
      patterns.push({
        type:     'warning',
        title:    'High baseline (≥100 mg/dL) doubles spike risk',
        body:     `Meals starting at ≥100 mg/dL: spike rate ${hStats.spikeRate}%, avg peak ${hStats.avgPeak}. Meals <100: spike rate ${lStats.spikeRate}%, avg peak ${lStats.avgPeak}. Space meals ≥4 hours to let glucose recover before eating again.`,
        evidence: highBaseline.map(m => m.id),
      })
    }
  }

  // ── 6. Same food, different strategy outcome ──
  const whiteRiceMeals = meals.filter(m =>
    m.foods.some(f => /white rice/i.test(f.name || f))
  )
  if (whiteRiceMeals.length >= 2) {
    const [best, worst] = [
      whiteRiceMeals.reduce((a, b) => a.glucose.peak < b.glucose.peak ? a : b),
      whiteRiceMeals.reduce((a, b) => a.glucose.peak > b.glucose.peak ? a : b),
    ]
    const gap = worst.glucose.peak - best.glucose.peak
    if (gap >= 20) {
      patterns.push({
        type:     'info',
        title:    `White rice peak varied by ${gap} mg/dL based on strategy alone`,
        body:     `With strategies (${best.id}): peak ${best.glucose.peak} mg/dL. Without (${worst.id}): peak ${worst.glucose.peak} mg/dL. Same food, different outcome — strategy matters more than food choice.`,
        evidence: whiteRiceMeals.map(m => m.id),
      })
    }
  }

  // ── 7. Best meal-type for control ──
  const byType = groupBy(meals, 'meal_type')
  for (const [type, group] of Object.entries(byType)) {
    const stats = mealStats(group)
    if (group.length >= 2 && stats.spikeRate === 0) {
      patterns.push({
        type:     'success',
        title:    `All ${type.replace('_', ' ')} meals were controlled (0% spike rate)`,
        body:     `${group.length} ${type.replace('_', ' ')} meals: avg peak ${stats.avgPeak} mg/dL, avg delta ${stats.avgDelta} mg/dL. Best consistent time window for glucose control.`,
        evidence: group.map(m => m.id),
      })
    }
  }

  return patterns
}

// ─── Per-Meal Insight Generation ──────────────────────────────────────────────

/**
 * Generates a complete structured insight object for a single meal.
 * This is the primary function to call per meal for UI rendering.
 *
 * @param {object} meal - A single meal from cgmData.json
 * @returns {MealInsight}
 */
export function generateMealInsight(meal) {
  const spiked      = isSpiked(meal)
  const severity    = getSpikeseverity(meal.glucose.peak)
  const sevMeta     = severityMeta(severity)
  const causes      = detectCauses(meal)
  const stabilisers = detectStabilisers(meal)
  const { foods: classifiedFoods, worstCase } = classifyMealFoods(meal)
  const delta       = meal.glucose.delta

  // Primary insight headline
  let headline = ''
  let recommendation = ''

  if (!spiked) {
    headline = delta <= 25
      ? 'Excellent control — minimal glucose impact'
      : delta <= 35
      ? 'Well controlled — strategies working effectively'
      : 'Controlled — just below spike threshold'

    const topStabiliser = stabilisers[0]
    recommendation = topStabiliser
      ? `Key factor: ${topStabiliser.label}. ${topStabiliser.effect}`
      : 'Food composition kept glucose stable. Continue this pattern.'
  } else {
    const topCause = causes[0]
    headline = topCause
      ? `Spike driven by: ${topCause.label}`
      : `Glucose spiked to ${meal.glucose.peak} mg/dL (Δ${delta})`

    recommendation = topCause
      ? topCause.tip
      : 'Add chia seeds pre-meal and a 10–15 min walk after eating.'
  }

  // Missing strategies (what could have been added)
  const missingStrategies = []
  if (!stabilisers.some(s => s.key === 'chia_seeds' || s.key === 'methi_seeds')) {
    missingStrategies.push({ key: 'fiber_supplement', label: 'Add chia or methi seeds pre-meal', impact: 'Reduces peak by ~15–20 mg/dL' })
  }
  if (!stabilisers.some(s => s.type === 'exercise' && s.key.includes('post'))) {
    missingStrategies.push({ key: 'post_meal_walk', label: '10–15 min walk after eating', impact: 'Reduces peak by ~20–30 mg/dL' })
  }
  if (!stabilisers.some(s => s.key === 'protein_present')) {
    missingStrategies.push({ key: 'add_protein', label: 'Include protein in the meal', impact: 'Slows gastric emptying; reduces peak ~15 mg/dL' })
  }

  return {
    id:           meal.id,
    datetime:     meal.datetime,
    date:         meal.date,
    day_of_week:  meal.day_of_week,
    meal_type:    meal.meal_type,
    label:        meal.label || meal.foods.map(f => f.name || f).join(', '),

    glucose: {
      baseline:     meal.glucose.baseline,
      peak:         meal.glucose.peak,
      delta:        meal.glucose.delta,
      peak_time_min: meal.glucose.peak_time_min,
      readings:     meal.glucose.readings,
    },

    spike:         spiked,
    spike_severity: severity,
    severity_meta: sevMeta,

    headline,
    recommendation,

    causes,
    stabilisers,
    missing_strategies: spiked ? missingStrategies : [],

    foods: classifiedFoods,
    worst_food: worstCase,

    tags: meal.tags || [],
    notes: meal.notes || '',
  }
}

// ─── Dataset-Level Analysis ───────────────────────────────────────────────────

/**
 * Analyses an entire meal dataset and returns a comprehensive insights report.
 * This is the top-level function to call with the full cgmData.meals array.
 *
 * @param {object[]} meals - Array of meal objects from cgmData.json
 * @returns {DatasetInsights}
 */
export function analyseDataset(meals) {
  const allInsights   = meals.map(generateMealInsight)
  const spikedMeals   = meals.filter(m => m.spike)
  const controlledMeals = meals.filter(m => !m.spike)
  const overallStats  = mealStats(meals)
  const patterns      = detectPatterns(meals)
  const foodRiskMap   = buildFoodRiskMap(meals)

  // Strategy effectiveness table
  const strategies = [
    { key: 'chia_seeds',       label: 'Chia Seeds',          test: m => m.pre_meal.some(p => /chia/i.test(p.item || p)) },
    { key: 'methi_seeds',      label: 'Methi Seeds',         test: m => m.pre_meal.some(p => /methi/i.test(p.item || p)) },
    { key: 'post_meal_walk',   label: 'Post-Meal Walk',       test: m => m.post_meal.some(p => /walk/i.test(p.activity || p)) },
    { key: 'post_meal_cycling',label: 'Post-Meal Cycling',    test: m => m.post_meal.some(p => /cycl/i.test(p.activity || p)) },
    { key: 'any_pre_meal',     label: 'Any Pre-Meal Strategy',test: m => m.pre_meal.length > 0 },
    { key: 'any_post_meal',    label: 'Any Post-Meal Activity',test: m => m.post_meal.length > 0 },
    { key: 'no_strategy',      label: 'No Strategy (both empty)', test: m => m.pre_meal.length === 0 && m.post_meal.length === 0 },
  ]

  const strategyEffectiveness = strategies.map(s => {
    const group = meals.filter(s.test)
    if (group.length === 0) return null
    const stats = mealStats(group)
    return {
      key:        s.key,
      label:      s.label,
      mealCount:  group.length,
      spikeRate:  stats.spikeRate,
      avgPeak:    stats.avgPeak,
      avgDelta:   stats.avgDelta,
      mealIds:    group.map(m => m.id),
    }
  }).filter(Boolean)

  // Cause frequency across all spiked meals
  const causeFrequency = {}
  for (const meal of spikedMeals) {
    for (const cause of detectCauses(meal)) {
      causeFrequency[cause.key] = (causeFrequency[cause.key] || 0) + 1
    }
  }
  const topCauses = Object.entries(causeFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => {
      const rule = CAUSE_RULES.find(r => r.key === key)
      return { key, label: rule?.label || key, count, pct: Math.round((count / spikedMeals.length) * 100) }
    })

  // Best and worst meals
  const sortedByDelta = [...meals].sort((a, b) => a.glucose.delta - b.glucose.delta)
  const bestMeals  = sortedByDelta.slice(0, 3).map(m => ({ id: m.id, delta: m.glucose.delta, peak: m.glucose.peak }))
  const worstMeals = sortedByDelta.slice(-3).reverse().map(m => ({ id: m.id, delta: m.glucose.delta, peak: m.glucose.peak }))

  // Safe vs risky food rankings
  const foodRankings = Object.values(foodRiskMap).sort((a, b) => b.avgDelta - a.avgDelta)
  const safeFoods    = foodRankings.filter(f => f.rating === 'safe'    && f.count >= 1)
  const moderateFoods = foodRankings.filter(f => f.rating === 'moderate')
  const riskyFoods   = foodRankings.filter(f => f.rating === 'risky')

  return {
    stats: overallStats,
    meal_insights: allInsights,
    patterns,
    strategy_effectiveness: strategyEffectiveness,
    top_spike_causes: topCauses,
    food_risk_map: foodRiskMap,
    food_rankings: { safe: safeFoods, moderate: moderateFoods, risky: riskyFoods },
    best_meals:  bestMeals,
    worst_meals: worstMeals,
  }
}

// ─── Convenience Helpers ──────────────────────────────────────────────────────

/** Returns meals filtered by spike status */
export const getSpikedMeals    = (meals) => meals.filter(m => m.spike)
export const getControlledMeals = (meals) => meals.filter(m => !m.spike)

/** Returns meals that had a specific stabiliser active */
export const getMealsWithStabiliser = (meals, key) =>
  meals.filter(m => detectStabilisers(m).some(s => s.key === key))

/** Returns meals that had a specific cause */
export const getMealsWithCause = (meals, key) =>
  meals.filter(m => detectCauses(m).some(c => c.key === key))

/** Quick GI band label for a numeric GI value */
export function giLabel(gi) {
  if (gi === 0) return { label: 'Zero GI', color: '#22C55E' }
  if (gi <= GI_BANDS.LOW.max)    return { label: GI_BANDS.LOW.label,    color: GI_BANDS.LOW.color    }
  if (gi <= GI_BANDS.MEDIUM.max) return { label: GI_BANDS.MEDIUM.label, color: GI_BANDS.MEDIUM.color }
  return                                 { label: GI_BANDS.HIGH.label,   color: GI_BANDS.HIGH.color   }
}

/** Returns a delta-based severity colour for use in charts */
export function deltaColor(delta) {
  if (delta <= DELTA_THRESHOLDS.low)      return '#22C55E'
  if (delta <= DELTA_THRESHOLDS.moderate) return '#F59E0B'
  if (delta <= DELTA_THRESHOLDS.high)     return '#F97316'
  return '#EF4444'
}
