import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { getAllReadings } from '../lib/dataService'

export default function Patterns() {
  const { user } = useUser(); const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
  const load = async ()=>{ if(!user?.id) return; setLoading(true); setError(''); try{setRows(await getAllReadings(user.id))}catch(e){setError(e.message)} setLoading(false)}
  useEffect(()=>{load()},[user?.id])
  const avg = useMemo(()=> rows.length ? Math.round(rows.filter(r=>r.glucose_value!=null).reduce((a,r)=>a+r.glucose_value,0)/rows.filter(r=>r.glucose_value!=null).length) : 0,[rows])
  if (loading) return <div className='p-6 text-sm text-slate-500'>Loading CGM patterns…</div>
  if (error) return <div className='m-6 p-3 border border-red-200 bg-red-50 rounded'><p className='text-sm text-red-700'>{error}</p><button onClick={load} className='mt-2 text-xs px-3 py-1 rounded bg-red-600 text-white'>Retry</button></div>
  if (!rows.length) return <div className='p-6'><p className='text-slate-600'>No CGM data uploaded yet</p><Link to='/upload' className='inline-block mt-3 px-3 py-2 text-sm rounded bg-blue-600 text-white'>Upload CSV</Link></div>
  return <div className='p-6'><h1 className='text-xl font-bold'>Patterns</h1><p className='text-slate-700'>CGM readings loaded from Supabase: {rows.length}</p><p className='text-slate-700'>Average glucose: {avg} mg/dL</p></div>
}
