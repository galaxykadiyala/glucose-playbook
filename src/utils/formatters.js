export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatPercent(value, decimals = 0) {
  return `${Number(value).toFixed(decimals)}%`
}

export function formatGlucose(value) {
  return `${value} mg/dL`
}

export function getEffectivenessLabel(score) {
  if (score >= 85) return 'Highly Effective'
  if (score >= 70) return 'Effective'
  if (score >= 55) return 'Moderately Effective'
  return 'Emerging'
}

export function getEfforLabel(effort) {
  const map = { low: 'Easy', medium: 'Moderate', high: 'Challenging' }
  return map[effort] || effort
}

export function getEvidenceLabel(evidence) {
  const map = {
    strong:   { label: 'Strong Evidence',   color: '#22C55E' },
    moderate: { label: 'Moderate Evidence', color: '#3B82F6' },
    emerging: { label: 'Emerging Evidence', color: '#8B5CF6' },
  }
  return map[evidence] || { label: evidence, color: '#6B7280' }
}

export function getRatingColor(rating) {
  const map = {
    excellent: { text: '#15803D', bg: '#DCFCE7', border: '#BBF7D0' },
    good:      { text: '#1D4ED8', bg: '#DBEAFE', border: '#BFDBFE' },
    moderate:  { text: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
    avoid:     { text: '#991B1B', bg: '#FEE2E2', border: '#FECACA' },
  }
  return map[rating] || { text: '#374151', bg: '#F3F4F6', border: '#E5E7EB' }
}

export function getCategoryColor(category) {
  const map = {
    exercise:   { text: '#1D4ED8', bg: '#DBEAFE' },
    diet:       { text: '#15803D', bg: '#DCFCE7' },
    lifestyle:  { text: '#7C3AED', bg: '#EDE9FE' },
    supplement: { text: '#0E7490', bg: '#CFFAFE' },
    food:       { text: '#92400E', bg: '#FEF3C7' },
    behavior:   { text: '#1D4ED8', bg: '#DBEAFE' },
    physiology: { text: '#6B7280', bg: '#F3F4F6' },
    grains:     { text: '#92400E', bg: '#FEF3C7' },
    vegetables: { text: '#15803D', bg: '#DCFCE7' },
    legumes:    { text: '#15803D', bg: '#DCFCE7' },
    fruits:     { text: '#B45309', bg: '#FEF3C7' },
    protein:    { text: '#1D4ED8', bg: '#DBEAFE' },
    dairy:      { text: '#0E7490', bg: '#CFFAFE' },
    beverages:  { text: '#7C3AED', bg: '#EDE9FE' },
    nuts:       { text: '#92400E', bg: '#FEF3C7' },
    fats:       { text: '#15803D', bg: '#DCFCE7' },
    sweets:     { text: '#B91C1C', bg: '#FEE2E2' },
  }
  return map[category] || { text: '#374151', bg: '#F3F4F6' }
}
