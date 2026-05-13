import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { detectCauses } from '../utils/insightsEngine'
import { useUser } from '../context/UserContext'
import { getMealLogs } from '../lib/dataService'

const toMeal = (log) => ({ foods: log.food_items.split(',').map(name => ({ name: name.trim(), gi_estimate: 60 })), pre_meal: [], post_meal: [], tags: [], glucose: { baseline: 100, peak: 125, delta: 25 }, spike: false })

export default function SpikeCauses() {
  const { user } = useUser(); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [rows,setRows]=useState([])
  const load = async ()=>{ if(!user?.id) return; setLoading(true); setError(''); try{setRows(await getMealLogs(user.id))}catch(e){setError(e.message)} setLoading(false)}
  useEffect(()=>{load()},[user?.id])
  const causes = useMemo(()=> rows.flatMap(r=>detectCauses(toMeal(r))).reduce((a,c)=>({ ...a,[c.label]:(a[c.label]||0)+1}),{}),[rows])
  if (loading) return <div className='p-6 text-sm text-slate-500'>Loading spike causes…</div>
  if (error) return <div className='m-6 p-3 border border-red-200 bg-red-50 rounded'><p className='text-sm text-red-700'>{error}</p><button onClick={load} className='mt-2 text-xs px-3 py-1 rounded bg-red-600 text-white'>Retry</button></div>
  if (!rows.length) return <div className='p-6'><p className='text-slate-600'>No meals logged yet</p><Link to='/whatsapp' className='inline-block mt-3 px-3 py-2 text-sm rounded bg-blue-600 text-white'>Connect WhatsApp</Link></div>
  return <div className='p-6'><h1 className='text-xl font-bold mb-3'>Spike Causes</h1>{Object.entries(causes).map(([k,v])=><p key={k} className='text-slate-700'>{k}: {v}</p>)}</div>
}
