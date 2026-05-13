import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { getAllReadings, getStints } from '../lib/dataService'

export default function DailyIntelligence() {
  const { user } = useUser(); const [state,setState]=useState({loading:true,error:'',rows:[],stints:[]})
  const load = async ()=>{ if(!user?.id) return; setState(s=>({...s,loading:true,error:''})); try{const [rows,stints]=await Promise.all([getAllReadings(user.id),getStints(user.id)]); setState({loading:false,error:'',rows,stints})}catch(e){setState({loading:false,error:e.message,rows:[],stints:[]})}}
  useEffect(()=>{load()},[user?.id])
  const byStint = useMemo(()=> state.stints.map(s=>({name:s.name,count:state.rows.filter(r=>r.stint_id===s.id).length})),[state])
  if (state.loading) return <div className='p-6 text-sm text-slate-500'>Loading daily intelligence…</div>
  if (state.error) return <div className='m-6 p-3 border border-red-200 bg-red-50 rounded'><p className='text-sm text-red-700'>{state.error}</p><button onClick={load} className='mt-2 text-xs px-3 py-1 rounded bg-red-600 text-white'>Retry</button></div>
  if (!state.rows.length) return <div className='p-6'><p className='text-slate-600'>No CGM data uploaded yet</p><Link to='/upload' className='inline-block mt-3 px-3 py-2 text-sm rounded bg-blue-600 text-white'>Upload CSV</Link></div>
  return <div className='p-6'><h1 className='text-xl font-bold mb-3'>Daily Intelligence</h1>{byStint.map(s=><p key={s.name}>{s.name}: {s.count} readings</p>)}</div>
}
