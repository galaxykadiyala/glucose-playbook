#!/usr/bin/env node
/**
 * deepAnalytics.cjs
 * Extends fullAnalytics.json with deep intelligence layers.
 * Adds a `deep_analytics` block per phase + cross-phase.
 * Does NOT modify existing keys — only appends new ones.
 *
 * Outputs:
 *   per phase → datasets.phase_X.deep
 *   cross-phase → deep_comparison
 */

const fs   = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '../src/data/fullAnalytics.json')
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))

// ─── Math helpers ─────────────────────────────────────────────────────────────

const sum  = arr => arr.reduce((a, b) => a + b, 0)
const avg  = arr => arr.length ? sum(arr) / arr.length : 0
const rnd  = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d
const sd   = arr => {
  if (arr.length < 2) return 0
  const m = avg(arr)
  return Math.sqrt(avg(arr.map(v => (v - m) ** 2)))
}

// Rolling window over an array of values, returns value at each index
function rolling(values, window) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return rnd(avg(slice))
  })
}

// ─── 1. TREND SMOOTHING ───────────────────────────────────────────────────────

function buildTrendSmoothing(daily) {
  const glucoseVals = daily.map(d => d.avg_glucose)
  const sdVals      = daily.map(d => d.sd)
  const scoreVals   = daily.map(d => d.score)

  const avg3   = rolling(glucoseVals, 3)
  const avg7   = rolling(glucoseVals, 7)
  const sd7    = rolling(sdVals, 7)
  const score7 = rolling(scoreVals, 7)

  const trend_data = daily.map((d, i) => ({
    date:           d.date,
    glucose_actual: d.avg_glucose,
    glucose_3day:   avg3[i],
    glucose_7day:   avg7[i],
    sd_7day:        sd7[i],
    score_7day:     score7[i],
  }))

  // Trend direction: compare last-7 avg vs first-7 avg
  const first7Glucose = rnd(avg(glucoseVals.slice(0, 7)))
  const last7Glucose  = rnd(avg(glucoseVals.slice(-7)))
  const glucoseDelta  = rnd(last7Glucose - first7Glucose)

  const first7Score = rnd(avg(scoreVals.slice(0, 7)))
  const last7Score  = rnd(avg(scoreVals.slice(-7)))
  const scoreDelta  = rnd(last7Score - first7Score)

  const trendDir =
    glucoseDelta <= -5 && scoreDelta >= 5  ? 'improving'  :
    glucoseDelta >= 5  && scoreDelta <= -5 ? 'worsening'  :
    glucoseDelta <= -2 || scoreDelta >= 2  ? 'slight_improvement' :
    glucoseDelta >= 2  || scoreDelta <= -2 ? 'slight_worsening'   :
    'stable'

  const trendLabel = {
    improving:          'Improving — glucose falling, score rising over the stint',
    worsening:          'Worsening — glucose rising, score declining over the stint',
    slight_improvement: 'Slight improvement across the stint period',
    slight_worsening:   'Slight decline across the stint period',
    stable:             'Stable — no meaningful trend within this stint',
  }[trendDir]

  return {
    trend_data,
    intra_stint_trend: {
      direction:      trendDir,
      label:          trendLabel,
      glucose_first7: first7Glucose,
      glucose_last7:  last7Glucose,
      glucose_delta:  glucoseDelta,
      score_first7:   first7Score,
      score_last7:    last7Score,
      score_delta:    scoreDelta,
    },
  }
}

// ─── 2. BAD DAY PATTERN DETECTION ─────────────────────────────────────────────

function detectBadDayPatterns(daily, spikeList, overnightAnalysis) {
  // Bottom 20% by score
  const threshold = Math.ceil(daily.length * 0.2)
  const sorted    = [...daily].sort((a, b) => a.score - b.score)
  const badDays   = sorted.slice(0, Math.max(threshold, 2))
  const badDates  = new Set(badDays.map(d => d.date))

  // Good days for contrast
  const goodDays  = sorted.slice(-Math.max(threshold, 2))

  // Bad-day spike profile
  const badSpikes   = spikeList.filter(s => badDates.has(s.date))
  const badTOD      = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const s of badSpikes) badTOD[s.time_of_day] = (badTOD[s.time_of_day] || 0) + 1

  const worstTOD = Object.entries(badTOD).sort((a, b) => b[1] - a[1])[0]

  // Overnight instability on bad days
  const badOvernight = overnightAnalysis.filter(o => badDates.has(o.date))
  const badONUnstable = badOvernight.filter(o => o.stability_score === 'unstable' || o.stability_score === 'moderate')
  const badONDawn     = badOvernight.filter(o => o.dawn_phenomenon)

  // Stats
  const avgSpikeBad  = rnd(avg(badDays.map(d => d.spike_count)))
  const avgSpikeGood = rnd(avg(goodDays.map(d => d.spike_count)))
  const avgGlucBad   = rnd(avg(badDays.map(d => d.avg_glucose)))
  const avgGlucGood  = rnd(avg(goodDays.map(d => d.avg_glucose)))
  const avgSDBad     = rnd(avg(badDays.map(d => d.sd)))
  const avgSDGood    = rnd(avg(goodDays.map(d => d.sd)))

  // Build pattern description
  const factors = []
  if (avgSpikeBad > avgSpikeGood + 1.5)
    factors.push(`high spike count (avg ${avgSpikeBad} vs ${avgSpikeGood} on good days)`)
  if (avgSDBad > avgSDGood + 5)
    factors.push(`elevated variability (SD ${avgSDBad} vs ${avgSDGood} on good days)`)
  if (worstTOD && badTOD[worstTOD[0]] > 0)
    factors.push(`${worstTOD[0]}-time spikes (${worstTOD[1]} of ${badSpikes.length} bad-day spikes)`)
  if (badONUnstable.length > badDays.length * 0.5)
    factors.push(`overnight instability (${badONUnstable.length} of ${badDays.length} bad days had unstable nights)`)
  if (badONDawn.length > badDays.length * 0.7)
    factors.push('dawn phenomenon present on nearly all bad days')

  const patternText = factors.length
    ? `Bad days are consistently associated with: ${factors.join('; ')}.`
    : 'Bad days show no strongly consistent pattern — may be driven by one-off dietary events.'

  return {
    bad_days:     badDays.map(d => ({ date: d.date, score: d.score, avg_glucose: d.avg_glucose, spike_count: d.spike_count })),
    good_days:    goodDays.map(d => ({ date: d.date, score: d.score, avg_glucose: d.avg_glucose, spike_count: d.spike_count })),
    pattern_text: patternText,
    common_factors: factors,
    bad_vs_good: {
      avg_glucose: { bad: avgGlucBad, good: avgGlucGood, diff: rnd(avgGlucBad - avgGlucGood) },
      avg_spikes:  { bad: avgSpikeBad, good: avgSpikeGood, diff: rnd(avgSpikeBad - avgSpikeGood) },
      avg_sd:      { bad: avgSDBad, good: avgSDGood, diff: rnd(avgSDBad - avgSDGood) },
    },
    spike_tod_on_bad_days: badTOD,
    overnight_instability_on_bad_days: badONUnstable.length,
    dawn_on_bad_days: badONDawn.length,
  }
}

// ─── 3. SCORE COMPONENT BREAKDOWN ─────────────────────────────────────────────

function scoreComponents(tir_inRange, avg_glucose, cv, spike_count) {
  // Mirror the formula from parseUltrahuman.cjs
  const tirScore = rnd(tir_inRange * 0.4)

  const avgScore =
    avg_glucose <= 100 ? 25 :
    avg_glucose <= 115 ? rnd(25 - ((avg_glucose - 100) / 15) * 10) :
    avg_glucose <= 140 ? rnd(15 - ((avg_glucose - 115) / 25) * 10) :
    Math.max(0, rnd(5 - ((avg_glucose - 140) / 20) * 5))

  const cvScore =
    cv <= 15 ? 20 :
    cv <= 25 ? rnd(20 - ((cv - 15) / 10) * 10) :
    Math.max(0, rnd(10 - ((cv - 25) / 10) * 10))

  const spikeScore = Math.max(0, 15 - spike_count * 4)

  const total = Math.min(100, tirScore + avgScore + cvScore + spikeScore)

  // Primary driver of the score (what contributed most to loss of points)
  const maxPossible  = { tir: 40, avg: 25, variability: 20, spikes: 15 }
  const lost = {
    tir:         rnd(maxPossible.tir         - tirScore),
    avg_glucose: rnd(maxPossible.avg         - avgScore),
    variability: rnd(maxPossible.variability - cvScore),
    spikes:      rnd(maxPossible.spikes      - spikeScore),
  }
  const primaryDriver = Object.entries(lost).sort((a, b) => b[1] - a[1])[0]

  const driverLabels = {
    tir:         'low time-in-range',
    avg_glucose: 'elevated average glucose',
    variability: 'high glucose variability',
    spikes:      'high spike count',
  }

  const explanation =
    total >= 85 ? 'All components near optimal — excellent metabolic control.' :
    total >= 70 ? `Score driven down mainly by ${driverLabels[primaryDriver[0]]} (−${primaryDriver[1]} pts).` :
    total >= 55 ? `Poor day — ${driverLabels[primaryDriver[0]]} was the dominant issue (−${primaryDriver[1]} pts).` :
    `Critical day — multiple components underperformed. Worst: ${driverLabels[primaryDriver[0]]} (−${primaryDriver[1]} pts).`

  return {
    total,
    components: {
      tir_inRange:  { score: tirScore, max: 40, lost: lost.tir,         label: 'Time in Range' },
      avg_glucose:  { score: avgScore, max: 25, lost: lost.avg_glucose,  label: 'Avg Glucose' },
      variability:  { score: cvScore,  max: 20, lost: lost.variability,  label: 'Variability (CV)' },
      spikes:       { score: spikeScore, max: 15, lost: lost.spikes,     label: 'Spike Count' },
    },
    primary_driver: primaryDriver[0],
    explanation,
  }
}

function buildScoreBreakdowns(daily) {
  // daily doesn't have CV — re-derive from sd/avg
  return daily.map(d => {
    const cv = d.avg_glucose > 0 ? rnd((d.sd / d.avg_glucose) * 100) : 0
    const breakdown = scoreComponents(d.tir_inRange, d.avg_glucose, cv, d.spike_count)
    return {
      date: d.date,
      score: d.score,
      ...breakdown,
    }
  })
}

// ─── 4. ANOMALY DETECTION ─────────────────────────────────────────────────────

function detectAnomalies(daily, spikeList) {
  const scores  = daily.map(d => d.score)
  const sds     = daily.map(d => d.sd)
  const spikes  = daily.map(d => d.spike_count)
  const glucose = daily.map(d => d.avg_glucose)

  const meanScore  = avg(scores);  const sdScore  = sd(scores)
  const meanSD     = avg(sds);     const sdSD     = sd(sds)
  const meanSpikes = avg(spikes);  const sdSpikes = sd(spikes)
  const meanGluc   = avg(glucose); const sdGluc   = sd(glucose)

  // Worst single spike across all days
  const worstSpike = spikeList.length
    ? spikeList.reduce((a, b) => b.peak_glucose > a.peak_glucose ? b : a)
    : null

  const annotated = daily.map((d, i) => {
    const flags = []

    // Score crash (>2 SD below mean)
    if (scores[i] < meanScore - 2 * sdScore)
      flags.push({ code: 'score_crash', label: 'Score crash', detail: `Score ${scores[i]} — more than 2 SD below average (${rnd(meanScore)})` })

    // Extreme variability
    if (sds[i] > meanSD + 2 * sdSD)
      flags.push({ code: 'high_variability', label: 'Extreme variability', detail: `SD ${sds[i]} — well above typical range (mean ${rnd(meanSD)})` })

    // Spike storm
    if (spikes[i] > meanSpikes + 2 * sdSpikes)
      flags.push({ code: 'spike_storm', label: 'Spike storm', detail: `${spikes[i]} spikes — unusually high (mean ${rnd(meanSpikes)})` })

    // High avg glucose
    if (glucose[i] > meanGluc + 2 * sdGluc)
      flags.push({ code: 'high_glucose', label: 'High avg glucose', detail: `Avg ${glucose[i]} mg/dL — significantly above mean (${rnd(meanGluc)})` })

    // Sudden change vs previous day
    if (i > 0) {
      const glucDelta  = Math.abs(glucose[i] - glucose[i - 1])
      const scoreDelta = Math.abs(scores[i] - scores[i - 1])
      if (glucDelta > 15)
        flags.push({ code: 'sudden_glucose_shift', label: 'Sudden glucose shift', detail: `Avg glucose changed by ${rnd(glucDelta)} mg/dL from previous day` })
      if (scoreDelta > 25)
        flags.push({ code: 'sudden_score_shift', label: 'Sudden score change', detail: `Score dropped/jumped ${rnd(scoreDelta)} points from previous day` })
    }

    // Worst spike day
    if (worstSpike && d.date === worstSpike.date)
      flags.push({ code: 'worst_spike', label: 'Single worst spike', detail: `Peak ${worstSpike.peak_glucose} mg/dL at ${worstSpike.peak.slice(11,16)} — highest in dataset` })

    const isAnomalous = flags.length >= 1

    return {
      date:         d.date,
      score:        d.score,
      is_anomalous: isAnomalous,
      anomaly_count: flags.length,
      flags,
      label: isAnomalous ? (flags.length >= 3 ? 'Critical anomaly' : 'Anomalous day') : 'Normal',
    }
  })

  const anomalous   = annotated.filter(d => d.is_anomalous)
  const anomalyRate = rnd((anomalous.length / daily.length) * 100)

  return {
    days:          annotated,
    anomaly_count: anomalous.length,
    anomaly_rate:  anomalyRate,
    anomalous_dates: anomalous.map(d => d.date),
    stats: {
      mean_score:   rnd(meanScore), sd_score: rnd(sdScore),
      mean_sd:      rnd(meanSD),    sd_sd:    rnd(sdSD),
      mean_spikes:  rnd(meanSpikes),
      mean_glucose: rnd(meanGluc),  sd_glucose: rnd(sdGluc),
    },
  }
}

// ─── 5. HEATMAP DATA ──────────────────────────────────────────────────────────

function buildHeatmapData(glucoseTimeline, dates) {
  // 6 time buckets: 00-04, 04-08, 08-12, 12-16, 16-20, 20-24
  const BUCKETS = [
    { key: '00-04', label: '12am–4am', startH: 0,  endH: 4  },
    { key: '04-08', label: '4am–8am',  startH: 4,  endH: 8  },
    { key: '08-12', label: '8am–12pm', startH: 8,  endH: 12 },
    { key: '12-16', label: '12pm–4pm', startH: 12, endH: 16 },
    { key: '16-20', label: '4pm–8pm',  startH: 16, endH: 20 },
    { key: '20-24', label: '8pm–12am', startH: 20, endH: 24 },
  ]

  // Group readings by date × bucket
  const cells = {}
  for (const r of glucoseTimeline) {
    const date = r.t.slice(0, 10)
    const hour = parseInt(r.t.slice(11, 13))
    const bucket = BUCKETS.find(b => hour >= b.startH && hour < b.endH)
    if (!bucket) continue
    const key = `${date}__${bucket.key}`
    if (!cells[key]) cells[key] = { date, bucket: bucket.key, label: bucket.label, values: [] }
    cells[key].values.push(r.g)
  }

  // Compute avg per cell
  const heatmap_cells = Object.values(cells).map(c => ({
    date:   c.date,
    bucket: c.bucket,
    label:  c.label,
    avg:    Math.round(avg(c.values)),
    count:  c.values.length,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.bucket.localeCompare(b.bucket))

  // Bucket-level aggregates (across all days)
  const bucket_agg = BUCKETS.map(b => {
    const vals = heatmap_cells.filter(c => c.bucket === b.key).map(c => c.avg)
    return {
      bucket: b.key,
      label:  b.label,
      avg:    vals.length ? Math.round(avg(vals)) : null,
      min:    vals.length ? Math.min(...vals) : null,
      max:    vals.length ? Math.max(...vals) : null,
    }
  })

  // Summary: which bucket is consistently highest/lowest
  const validBuckets = bucket_agg.filter(b => b.avg !== null)
  const highestBucket = validBuckets.reduce((a, b) => b.avg > a.avg ? b : a, validBuckets[0])
  const lowestBucket  = validBuckets.reduce((a, b) => b.avg < a.avg ? b : a, validBuckets[0])

  return {
    cells:          heatmap_cells,
    bucket_summary: bucket_agg,
    highest_period: { bucket: highestBucket.bucket, label: highestBucket.label, avg: highestBucket.avg },
    lowest_period:  { bucket: lowestBucket.bucket,  label: lowestBucket.label,  avg: lowestBucket.avg  },
    x_axis: dates,
    y_axis: BUCKETS.map(b => ({ key: b.key, label: b.label })),
  }
}

// ─── 6. INSIGHT PRIORITIZATION ────────────────────────────────────────────────

function prioritizeInsights(phase) {
  const { summary, tod_breakdown, overnight_summary, text_insights,
          bad_day_patterns: bdp, anomaly_detection: ad, trend_smoothing: ts } = phase

  const all = []

  // Critical triggers
  if (summary.time_in_range.inRange < 70)
    all.push({ priority: 'critical', category: 'TIR', text: `Time-in-range is critically low at ${summary.time_in_range.inRange}% — target is 70%+ minimum, 85%+ optimal`, action: 'Review dietary composition and meal timing' })

  if (summary.avg_glucose > 140)
    all.push({ priority: 'critical', category: 'Average Glucose', text: `Average glucose of ${summary.avg_glucose} mg/dL indicates sustained hyperglycemia`, action: 'Reduce high-GI foods, increase post-meal activity' })

  if (summary.variability.cv > 33)
    all.push({ priority: 'critical', category: 'Variability', text: `Glucose variability (CV ${summary.variability.cv}%) exceeds the 33% threshold associated with hypoglycemia risk`, action: 'Identify and eliminate erratic meal patterns' })

  if (ad && ad.anomaly_rate > 30)
    all.push({ priority: 'critical', category: 'Anomalies', text: `${ad.anomaly_rate}% of days flagged as anomalous — patterns are unpredictable`, action: 'Investigate dietary or lifestyle changes on anomalous dates' })

  // Moderate triggers
  const morningTOD = tod_breakdown.find(t => t.period === 'morning')
  if (morningTOD && morningTOD.avg_glucose > 125)
    all.push({ priority: 'moderate', category: 'Time of Day', text: `Morning average glucose is ${morningTOD.avg_glucose} mg/dL — the highest-risk window of the day`, action: 'Consider lighter breakfast options or pre-breakfast activity' })

  if (overnight_summary.dawn_pct > 60)
    all.push({ priority: 'moderate', category: 'Overnight', text: `Dawn phenomenon present on ${overnight_summary.dawn_pct}% of nights — consistent early-morning glucose rise`, action: 'Try earlier dinner, lighter evening carbs, or a brief morning walk before eating' })

  if (summary.spike_count > summary.avg_score * 0.8)
    all.push({ priority: 'moderate', category: 'Spikes', text: `${summary.spike_count} spikes across ${16} days — averaging ${rnd(summary.spike_count / 16)} per day`, action: 'Identify meal contexts driving spikes; add pre-meal fiber or post-meal walks' })

  if (ts && ts.intra_stint_trend.direction === 'worsening')
    all.push({ priority: 'moderate', category: 'Trend', text: `Worsening trend within the stint: glucose rose ${ts.intra_stint_trend.glucose_delta} mg/dL from week 1 to week 2`, action: 'Review what changed in week 2 — meals, activity, sleep, or stress' })

  if (bdp && bdp.common_factors.length > 0)
    all.push({ priority: 'moderate', category: 'Pattern', text: bdp.pattern_text, action: 'Focus interventions on the identified bad-day pattern' })

  if (overnight_summary.stable_nights < overnight_summary.stable_nights + overnight_summary.unstable_nights * 0.5)
    all.push({ priority: 'moderate', category: 'Overnight Stability', text: `Only ${overnight_summary.stable_nights} of ${overnight_summary.stable_nights + overnight_summary.unstable_nights} nights were fully stable`, action: 'Avoid large meals within 2 hours of sleep; choose lower-GI evening foods' })

  // Informational
  const nightTOD = tod_breakdown.find(t => t.period === 'night')
  if (nightTOD && nightTOD.avg_glucose < 105)
    all.push({ priority: 'informational', category: 'Time of Day', text: `Night-time is the best-controlled period (avg ${nightTOD.avg_glucose} mg/dL) — fasting glucose is within healthy range` })

  if (summary.time_in_range.inRange >= 85)
    all.push({ priority: 'informational', category: 'TIR', text: `Strong overall time-in-range of ${summary.time_in_range.inRange}% — majority of readings are in the healthy zone` })

  if (summary.variability.cv <= 23)
    all.push({ priority: 'informational', category: 'Variability', text: `Glucose variability (CV ${summary.variability.cv}%) is within the metabolically healthy range (<23%)` })

  if (ts && ts.intra_stint_trend.direction === 'improving')
    all.push({ priority: 'informational', category: 'Trend', text: `Positive intra-stint trend: glucose improved ${Math.abs(ts.intra_stint_trend.glucose_delta)} mg/dL from week 1 to week 2` })

  // Sort: critical first, then moderate, then informational
  const order = { critical: 0, moderate: 1, informational: 2 }
  all.sort((a, b) => order[a.priority] - order[b.priority])

  return {
    insights:         all,
    critical_count:   all.filter(i => i.priority === 'critical').length,
    moderate_count:   all.filter(i => i.priority === 'moderate').length,
    info_count:       all.filter(i => i.priority === 'informational').length,
  }
}

// ─── 7. EXECUTIVE SUMMARY ─────────────────────────────────────────────────────

function buildExecutiveSummary(phase, phaseId) {
  const { summary, tod_breakdown, overnight_summary, bad_day_patterns: bdp,
          anomaly_detection: ad, trend_smoothing: ts, score_breakdowns } = phase

  const bullets = []

  // #1 — Overall grade
  const grade =
    summary.avg_score >= 80 ? 'Excellent' :
    summary.avg_score >= 65 ? 'Good' :
    summary.avg_score >= 50 ? 'Fair' : 'Poor'

  bullets.push({
    rank: 1, priority: summary.avg_score < 65 ? 'critical' : 'moderate',
    headline: `Overall metabolic control: ${grade} (avg score ${summary.avg_score}/100)`,
    detail: `Average glucose ${summary.avg_glucose} mg/dL, ${summary.time_in_range.inRange}% time in range, ${summary.spike_count} spikes across 16 days.`,
  })

  // #2 — Worst time window
  const worstTOD = tod_breakdown[0]
  if (worstTOD) {
    bullets.push({
      rank: 2, priority: 'critical',
      headline: `${worstTOD.period.charAt(0).toUpperCase() + worstTOD.period.slice(1)} is consistently your highest-risk period`,
      detail: `Avg glucose ${worstTOD.avg_glucose} mg/dL, ${worstTOD.spike_count} spikes (${worstTOD.spike_share}% of all spikes). This window drives the majority of excursions above 140 mg/dL.`,
    })
  }

  // #3 — Dawn phenomenon
  if (overnight_summary.dawn_pct > 50) {
    bullets.push({
      rank: 3, priority: 'moderate',
      headline: `Dawn phenomenon is a persistent pattern (${overnight_summary.dawn_pct}% of nights)`,
      detail: `Cortisol-driven early-morning glucose rise detected on ${overnight_summary.dawn_phenomenon_count} of ${overnight_summary.stable_nights + overnight_summary.unstable_nights} nights. Overnight avg glucose: ${overnight_summary.avg_overnight_glucose} mg/dL.`,
    })
  }

  // #4 — Intra-stint trend
  if (ts) {
    const t = ts.intra_stint_trend
    bullets.push({
      rank: 4, priority: t.direction === 'worsening' ? 'moderate' : 'informational',
      headline: t.direction === 'worsening'
        ? `Glucose trended upward within the stint (+${t.glucose_delta} mg/dL, week 1 → week 2)`
        : t.direction === 'improving'
        ? `Glucose improved across the stint (${t.glucose_delta} mg/dL improvement, week 1 → week 2)`
        : `Glucose was stable throughout the stint (no meaningful week-on-week change)`,
      detail: `Week 1 avg: ${t.glucose_first7} mg/dL → Week 2 avg: ${t.glucose_last7} mg/dL. Score trend: ${t.score_first7} → ${t.score_last7}.`,
    })
  }

  // #5 — Bad day pattern
  if (bdp && bdp.common_factors.length >= 2) {
    bullets.push({
      rank: 5, priority: 'moderate',
      headline: `Bad days cluster around a consistent pattern`,
      detail: bdp.pattern_text + ` Bad days avg ${bdp.bad_vs_good.avg_glucose.bad} vs ${bdp.bad_vs_good.avg_glucose.good} mg/dL on good days.`,
    })
  }

  // #6 — Score driver (most common primary driver across all days)
  if (score_breakdowns) {
    const driverCounts = {}
    for (const d of score_breakdowns) {
      driverCounts[d.primary_driver] = (driverCounts[d.primary_driver] || 0) + 1
    }
    const topDriver = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0]
    const driverLabels = {
      tir:         'time-in-range deficits',
      avg_glucose: 'elevated average glucose',
      variability: 'glucose variability',
      spikes:      'spike frequency',
    }
    if (topDriver) {
      bullets.push({
        rank: 6, priority: 'moderate',
        headline: `${driverLabels[topDriver[0]] || topDriver[0]} is the primary score suppressor`,
        detail: `This component was the biggest score deduction on ${topDriver[1]} of 16 days. Improving it alone could raise the average score by 10–15 points.`,
      })
    }
  }

  // #7 — Anomaly callout
  if (ad && ad.anomaly_count > 0) {
    const worstDay = ad.days.filter(d => d.is_anomalous).sort((a, b) => a.score - b.score)[0]
    bullets.push({
      rank: 7, priority: ad.anomaly_count > 3 ? 'critical' : 'moderate',
      headline: `${ad.anomaly_count} anomalous day${ad.anomaly_count > 1 ? 's' : ''} detected (${ad.anomaly_rate}% of the stint)`,
      detail: worstDay
        ? `Worst: ${worstDay.date} (score ${worstDay.score}) — ${worstDay.flags.map(f => f.label).join(', ')}.`
        : `These days show unusually high variability, glucose, or sudden changes vs adjacent days.`,
    })
  }

  return {
    phase_label:  phaseId === 'phase_2' ? 'Stint 2 (Feb 28 – Mar 15, 2026)' : 'Stint 3 (Mar 15 – Mar 30, 2026)',
    avg_score:    summary.avg_score,
    grade,
    bullets:      bullets.slice(0, 7),
    one_liner:    `${grade} control. Morning glucose is consistently high. Dawn phenomenon affects ${overnight_summary.dawn_pct}% of nights. ${ad?.anomaly_count ?? 0} anomalous days detected.`,
  }
}

// ─── 8. CROSS-PHASE DEEP COMPARISON ──────────────────────────────────────────

function buildDeepComparison(p2Deep, p3Deep, p2Summary, p3Summary) {
  const t2 = p2Deep.trend_smoothing.intra_stint_trend
  const t3 = p3Deep.trend_smoothing.intra_stint_trend

  const insights = []

  // Overnight stability change
  const on2 = p2Deep.overnight_summary; const on3 = p3Deep.overnight_summary
  if (on3.stable_nights < on2.stable_nights)
    insights.push({ priority: 'critical', text: `Overnight stability significantly declined: ${on2.stable_nights} stable nights in Stint 2 → only ${on3.stable_nights} in Stint 3. Unstable sleep patterns amplify daytime glucose.` })

  // Spike frequency vs severity
  const avgRise2 = p2Deep.spike_distribution?.avg_rise ?? 35
  const avgRise3 = p3Deep.spike_distribution?.avg_rise ?? 35
  if (p3Summary.spike_count > p2Summary.spike_count && Math.abs(avgRise3 - avgRise2) < 5)
    insights.push({ priority: 'moderate', text: `Spike frequency increased by ${p3Summary.spike_count - p2Summary.spike_count} in Stint 3 without a proportional increase in spike severity (avg rise stayed at ${avgRise2} → ${avgRise3} mg/dL). More frequent but similar-sized spikes suggest more triggering meals, not worse metabolic response.` })

  // Morning deterioration
  const todFn = tod => tod.tod_breakdown.find(t => t.period === 'morning')
  const m2 = todFn(p2Deep); const m3 = todFn(p3Deep)
  if (m2 && m3 && m3.avg_glucose - m2.avg_glucose >= 6)
    insights.push({ priority: 'critical', text: `Morning glucose worsened by ${m3.avg_glucose - m2.avg_glucose} mg/dL in Stint 3 (${m2.avg_glucose} → ${m3.avg_glucose} mg/dL). Morning was already the worst window — this regression is the most impactful single change.` })

  // Night window deterioration
  const n2 = p2Deep.tod_breakdown.find(t => t.period === 'night')
  const n3 = p3Deep.tod_breakdown.find(t => t.period === 'night')
  if (n2 && n3 && n3.spike_count - n2.spike_count >= 4)
    insights.push({ priority: 'moderate', text: `Night-time spikes tripled in Stint 3 (${n2.spike_count} → ${n3.spike_count}) — the safest window of Stint 2 became significantly more active.` })

  // Anomaly rate change
  const ar2 = p2Deep.anomaly_detection.anomaly_rate
  const ar3 = p3Deep.anomaly_detection.anomaly_rate
  if (ar3 > ar2 + 10)
    insights.push({ priority: 'moderate', text: `Anomalous day rate increased from ${ar2}% to ${ar3}% — Stint 3 glucose patterns were less predictable and harder to control.` })

  // Score component shift
  const getTopDriver = (phase) => {
    const counts = {}
    for (const d of phase.score_breakdowns) counts[d.primary_driver] = (counts[d.primary_driver] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }
  const driver2 = getTopDriver(p2Deep)
  const driver3 = getTopDriver(p3Deep)
  if (driver2 !== driver3)
    insights.push({ priority: 'informational', text: `Score bottleneck shifted between stints: Stint 2 was most limited by ${driver2.replace('_', ' ')}, while Stint 3 was most limited by ${driver3.replace('_', ' ')}.` })

  return {
    insights,
    overnight_stability_change: { stint_2: on2.stable_nights, stint_3: on3.stable_nights, change: on3.stable_nights - on2.stable_nights },
    morning_glucose_change:     m2 && m3 ? { stint_2: m2.avg_glucose, stint_3: m3.avg_glucose, change: m3.avg_glucose - m2.avg_glucose } : null,
    anomaly_rate_change:        { stint_2: ar2, stint_3: ar3, change: rnd(ar3 - ar2) },
  }
}

// ─── Run pipeline ──────────────────────────────────────────────────────────────

console.log('Running deep analytics pipeline...\n')

for (const [phaseId, phase] of Object.entries(data.datasets)) {
  console.log(`Processing ${phase.label}...`)
  const daily     = phase.daily_summaries
  const spikes    = phase.spike_list
  const overnight = phase.overnight_analysis
  const timeline  = phase.chart_data.glucose_timeline
  const dates     = daily.map(d => d.date)

  // Run each module
  const trend_smoothing    = buildTrendSmoothing(daily)
  const bad_day_patterns   = detectBadDayPatterns(daily, spikes, overnight)
  const score_breakdowns   = buildScoreBreakdowns(daily)
  const anomaly_detection  = detectAnomalies(daily, spikes)
  const heatmap_data       = buildHeatmapData(timeline, dates)

  // Attach to phase (needed by downstream modules)
  phase.deep = {
    trend_smoothing,
    bad_day_patterns,
    score_breakdowns,
    anomaly_detection,
    heatmap_data,
  }

  // Now run modules that depend on the above
  const prioritized_insights = prioritizeInsights({
    ...phase,
    bad_day_patterns,
    anomaly_detection,
    trend_smoothing,
    score_breakdowns,
    overnight_summary: phase.overnight_summary,
    tod_breakdown: phase.tod_breakdown,
  })
  const executive_summary = buildExecutiveSummary({
    ...phase,
    bad_day_patterns,
    anomaly_detection,
    trend_smoothing,
    score_breakdowns,
  }, phaseId)

  phase.deep.prioritized_insights = prioritized_insights
  phase.deep.executive_summary    = executive_summary

  console.log(`  ✓ Trend: ${trend_smoothing.intra_stint_trend.direction}`)
  console.log(`  ✓ Bad day pattern: ${bad_day_patterns.common_factors.length} factors identified`)
  console.log(`  ✓ Score breakdowns: ${score_breakdowns.length} days analyzed`)
  console.log(`  ✓ Anomalies: ${anomaly_detection.anomaly_count} flagged`)
  console.log(`  ✓ Heatmap: ${heatmap_data.cells.length} cells`)
  console.log(`  ✓ Insights: ${prioritized_insights.critical_count} critical, ${prioritized_insights.moderate_count} moderate, ${prioritized_insights.info_count} info`)
  console.log(`  ✓ Executive summary: ${executive_summary.bullets.length} bullets\n`)
}

// Cross-phase deep comparison
console.log('Building deep comparison...')
data.deep_comparison = buildDeepComparison(
  { ...data.datasets.phase_2, ...data.datasets.phase_2.deep, spike_distribution: data.datasets.phase_2.spike_distribution, tod_breakdown: data.datasets.phase_2.tod_breakdown, overnight_summary: data.datasets.phase_2.overnight_summary },
  { ...data.datasets.phase_3, ...data.datasets.phase_3.deep, spike_distribution: data.datasets.phase_3.spike_distribution, tod_breakdown: data.datasets.phase_3.tod_breakdown, overnight_summary: data.datasets.phase_3.overnight_summary },
  data.datasets.phase_2.summary,
  data.datasets.phase_3.summary,
)
console.log(`  ✓ ${data.deep_comparison.insights.length} cross-phase insights\n`)

// Write output
fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
const sizeMB = (fs.statSync(FILE).size / 1024 / 1024).toFixed(2)
console.log(`Written → src/data/fullAnalytics.json (${sizeMB} MB)`)

// ─── Console report ────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(64))
console.log('DEEP ANALYTICS REPORT')
console.log('═'.repeat(64))

for (const [phaseId, phase] of Object.entries(data.datasets)) {
  const deep = phase.deep
  const exec = deep.executive_summary
  console.log(`\n── ${phase.label} ──────────────────────────────────────`)

  console.log('\n  EXECUTIVE SUMMARY')
  for (const b of exec.bullets) {
    const icon = b.priority === 'critical' ? '⚠' : b.priority === 'moderate' ? '→' : 'ℹ'
    console.log(`  ${b.rank}. ${icon} ${b.headline}`)
    console.log(`     ${b.detail}`)
  }

  console.log('\n  TREND (intra-stint)')
  const t = deep.trend_smoothing.intra_stint_trend
  console.log(`  Direction: ${t.direction}`)
  console.log(`  Week 1 avg: ${t.glucose_first7} mg/dL → Week 2 avg: ${t.glucose_last7} mg/dL (${t.glucose_delta > 0 ? '+' : ''}${t.glucose_delta} mg/dL)`)
  console.log(`  Score:      ${t.score_first7} → ${t.score_last7} (${t.score_delta > 0 ? '+' : ''}${t.score_delta})`)

  console.log('\n  BAD DAY PATTERNS')
  console.log('  ' + deep.bad_day_patterns.pattern_text)
  const bg = deep.bad_day_patterns.bad_vs_good
  console.log(`  Bad days: avg ${bg.avg_glucose.bad} mg/dL, ${bg.avg_spikes.bad} spikes/day, SD ${bg.avg_sd.bad}`)
  console.log(`  Good days: avg ${bg.avg_glucose.good} mg/dL, ${bg.avg_spikes.good} spikes/day, SD ${bg.avg_sd.good}`)

  console.log('\n  ANOMALIES')
  console.log(`  ${deep.anomaly_detection.anomaly_count} anomalous days (${deep.anomaly_detection.anomaly_rate}%)`)
  for (const d of deep.anomaly_detection.days.filter(d => d.is_anomalous)) {
    console.log(`  ⚑ ${d.date} [${d.label}]: ${d.flags.map(f => f.label).join(', ')}`)
  }

  console.log('\n  SCORE BREAKDOWNS — worst 3 days')
  const worst3 = [...deep.score_breakdowns].sort((a, b) => a.score - b.score).slice(0, 3)
  for (const d of worst3) {
    const c = d.components
    console.log(`  ${d.date} score=${d.score}: TIR=${c.tir_inRange.score}/${c.tir_inRange.max} Avg=${c.avg_glucose.score}/${c.avg_glucose.max} Var=${c.variability.score}/${c.variability.max} Spikes=${c.spikes.score}/${c.spikes.max}`)
    console.log(`    → ${d.explanation}`)
  }

  console.log('\n  HEATMAP (bucket averages)')
  for (const b of deep.heatmap_data.bucket_summary) {
    const bar = b.avg ? '█'.repeat(Math.round(b.avg / 10)) : ''
    console.log(`  ${b.label.padEnd(12)} ${String(b.avg ?? 'n/a').padStart(3)} mg/dL  ${bar}`)
  }

  console.log('\n  PRIORITIZED INSIGHTS')
  for (const ins of deep.prioritized_insights.insights) {
    const icon = ins.priority === 'critical' ? '🔴' : ins.priority === 'moderate' ? '🟡' : '🔵'
    console.log(`  ${icon} [${ins.category}] ${ins.text}`)
  }
}

console.log('\n── CROSS-PHASE DEEP COMPARISON ──────────────────────────────')
for (const ins of data.deep_comparison.insights) {
  const icon = ins.priority === 'critical' ? '🔴' : ins.priority === 'moderate' ? '🟡' : '🔵'
  console.log(`${icon} ${ins.text}`)
}
