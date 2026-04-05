/**
 * glucoseZones.js
 * Zone definitions, color palette, and data transformation for zone-based
 * glucose chart rendering. All chart components should import from here.
 */

// ─── Zone config ──────────────────────────────────────────────────────────────

export const ZONE_COLORS = {
  stable:   { stroke: '#22c55e', fill: '#22c55e', bg: '#f0fdf4', label: 'Stable'   },
  elevated: { stroke: '#eab308', fill: '#eab308', bg: '#fefce8', label: 'Elevated' },
  spike:    { stroke: '#ef4444', fill: '#ef4444', bg: '#fef2f2', label: 'Spike'    },
}

// ─── Zone classifier ──────────────────────────────────────────────────────────

/** Returns 'stable' | 'elevated' | 'spike' | null */
export function getZone(glucose) {
  if (glucose == null || isNaN(glucose)) return null
  if (glucose <= 120) return 'stable'
  if (glucose <= 140) return 'elevated'
  return 'spike'
}

// ─── Zone label helper ────────────────────────────────────────────────────────

export function zoneLabel(glucose) {
  const z = getZone(glucose)
  return z ? ZONE_COLORS[z].label : '—'
}

// ─── Segment transformer ──────────────────────────────────────────────────────

/**
 * Transforms a glucose time series into zone-segmented data for Recharts.
 *
 * Input:  Array<{ [glucoseKey]: number, ...rest }>
 * Output: Array<{ stable: number|null, elevated: number|null, spike: number|null, ...rest }>
 *
 * At zone boundaries the value is included in BOTH adjacent zones so that
 * Recharts draws a visually seamless line transition — no gaps, no jumps.
 *
 * @param {Array<object>} readings
 * @param {string} [glucoseKey='glucose']
 */
export function toZoneSegments(readings, glucoseKey = 'glucose') {
  return readings.map((r, i) => {
    const g = r[glucoseKey]

    if (g == null) {
      return { ...r, stable: null, elevated: null, spike: null }
    }

    const prev = readings[i - 1]?.[glucoseKey] ?? null
    const next = readings[i + 1]?.[glucoseKey] ?? null

    const zone     = getZone(g)
    const prevZone = getZone(prev)
    const nextZone = getZone(next)

    const seg = { ...r, stable: null, elevated: null, spike: null }
    seg[zone] = g

    // Boundary overlap — ensures the line from the adjacent zone reaches
    // this point, creating a smooth visual transition
    if (prevZone && prevZone !== zone) seg[prevZone] = g
    if (nextZone && nextZone !== zone) seg[nextZone] = g

    return seg
  })
}

// ─── Spike peak detector ──────────────────────────────────────────────────────

/**
 * Returns true if index i is a local maximum in the spike zone.
 * Used to place spike peak markers without cluttering every spike point.
 */
export function isSpikePeak(zoneData, i) {
  const g = zoneData[i]?.spike
  if (!g) return false
  const prev = zoneData[i - 1]?.spike ?? zoneData[i - 1]?.elevated ?? zoneData[i - 1]?.stable ?? 0
  const next = zoneData[i + 1]?.spike ?? zoneData[i + 1]?.elevated ?? zoneData[i + 1]?.stable ?? 0
  return g >= prev && g >= next
}
