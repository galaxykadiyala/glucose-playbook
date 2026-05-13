import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyseDataset } from '../utils/insightsEngine'
import { useUser } from '../context/UserContext'
import { getMealLogs } from '../lib/dataService'

function toMeal(log, i) {
  return {
    id: log.id || `meal_${i}`,
    date: (log.timestamp || '').slice(0, 10),
    datetime: log.timestamp,
    foods: log.food_items.split(',').map(s => ({ name: s.trim(), gi_estimate: 55 })),
    pre_meal: [],
    post_meal: [],
    tags: [],
    glucose: { baseline: 100, peak: 125, delta: 25 },
    spike: false,
  }
}

export default function Dashboard() {
  const { user } = useUser()
  const [state, setState] = useState({ loading: true, error: '', rows: [] })
  const load = async () => {
    if (!user?.id) return
    setState(s => ({ ...s, loading: true, error: '' }))
    try { setState({ loading: false, error: '', rows: await getMealLogs(user.id) }) } catch (e) { setState({ loading: false, error: e.message, rows: [] }) }
  }
  useEffect(() => { load() }, [user?.id])
  const insights = useMemo(() => analyseDataset(state.rows.map(toMeal)), [state.rows])
  if (state.loading) return <div className="p-6 text-sm text-slate-500">Loading dashboard…</div>
  if (state.error) return <div className="m-6 p-3 border border-red-200 bg-red-50 rounded"><p className="text-sm text-red-700">{state.error}</p><button onClick={load} className="mt-2 text-xs px-3 py-1 rounded bg-red-600 text-white">Retry</button></div>
  if (!state.rows.length) return <div className="p-6"><p className="text-slate-600">No meals logged yet</p><Link to="/whatsapp" className="inline-block mt-3 px-3 py-2 text-sm rounded bg-blue-600 text-white">Connect WhatsApp</Link></div>
  return <div className="p-6"><h1 className="text-xl font-bold mb-2">Dashboard</h1><p className="text-slate-600">Meals loaded from Supabase: {state.rows.length}</p><p className="text-slate-600">Detected spike meals: {insights?.summary?.spikes ?? 0}</p></div>
}
