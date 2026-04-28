import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/UserContext'

function parseUltrahumanCSV(text) {
  const lines = text.trim().split('\n')
  // Skip header row
  const rows = lines.slice(1)

  const readings = []
  const events   = []
  let minTs = null
  let maxTs = null

  for (const line of rows) {
    if (!line.trim()) continue
    const comma = line.indexOf(',')
    if (comma === -1) continue
    const ts  = line.slice(0, comma).trim().replace(/"/g, '')
    const val = line.slice(comma + 1).trim().replace(/"/g, '')
    if (!ts) continue

    const num = Number(val)
    if (!isNaN(num) && val !== '') {
      readings.push({ timestamp: ts, glucose_value: num })
    } else {
      events.push({ timestamp: ts, event_label: val })
    }

    const d = new Date(ts)
    if (!isNaN(d)) {
      if (!minTs || d < minTs) minTs = d
      if (!maxTs || d > maxTs) maxTs = d
    }
  }

  return { readings, events, minTs, maxTs }
}

function fmtDate(d) {
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CSVUpload({ onSuccess }) {
  const { user }           = useUser()
  const fileInputRef       = useRef(null)
  const [dragging, setDragging]   = useState(false)
  const [parsed, setParsed]       = useState(null)   // { readings, events, minTs, maxTs, fileName }
  const [stintName, setStintName] = useState('')
  const [progress, setProgress]   = useState(null)   // { done, total }
  const [done, setDone]           = useState(null)   // summary object
  const [error, setError]         = useState('')

  function reset() {
    setParsed(null)
    setStintName('')
    setProgress(null)
    setDone(null)
    setError('')
  }

  function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please select a .csv file.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const result = parseUltrahumanCSV(e.target.result)
        if (result.readings.length === 0) {
          setError('No glucose readings found. Check the CSV format.')
          return
        }
        // Suggest a stint name from the date range
        const suggest = result.minTs
          ? `${result.minTs.toLocaleDateString('en-US', { month: 'short' })}–${result.maxTs.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`
          : ''
        setStintName(suggest)
        setParsed({ ...result, fileName: file.name })
      } catch {
        setError('Failed to parse CSV. Make sure it is an Ultrahuman export.')
      }
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [])

  const onDragOver = useCallback(e => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])

  async function handleConfirm() {
    if (!stintName.trim()) { setError('Please enter a name for this stint.'); return }
    if (!user) { setError('Not signed in.'); return }
    setError('')

    const { readings, events, minTs, maxTs } = parsed
    const allRows = [
      ...readings.map(r => ({ timestamp: r.timestamp, glucose_value: r.glucose_value, event_label: null })),
      ...events.map(r => ({ timestamp: r.timestamp, glucose_value: null, event_label: r.event_label })),
    ]

    try {
      // 1. Create the stint
      const { data: stint, error: stintErr } = await supabase
        .from('cgm_stints')
        .insert({
          user_id:     user.id,
          name:        stintName.trim(),
          start_date:  minTs.toISOString().slice(0, 10),
          end_date:    maxTs.toISOString().slice(0, 10),
          sensor_type: 'Ultrahuman',
        })
        .select()
        .single()
      if (stintErr) throw stintErr

      // 2. Batch-insert readings in chunks of 500
      const CHUNK = 500
      let inserted = 0
      for (let i = 0; i < allRows.length; i += CHUNK) {
        const chunk = allRows.slice(i, i + CHUNK).map(r => ({
          stint_id:     stint.id,
          user_id:      user.id,
          timestamp:    r.timestamp,
          glucose_value: r.glucose_value,
          event_label:  r.event_label,
        }))
        const { error: insertErr } = await supabase.from('cgm_readings').insert(chunk)
        if (insertErr) throw insertErr
        inserted += chunk.length
        setProgress({ done: inserted, total: allRows.length })
      }

      setDone({
        stintName: stint.name,
        readings:  readings.length,
        events:    events.length,
        start:     fmtDate(minTs),
        end:       fmtDate(maxTs),
      })
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Upload failed.')
      setProgress(null)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700/60 p-6 text-center max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Upload complete</h3>
        <p className="text-sm font-medium text-blue-600 mb-3">{done.stintName}</p>
        <dl className="grid grid-cols-2 gap-3 text-left mb-5">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide">Readings</dt>
            <dd className="text-lg font-bold text-slate-900 dark:text-slate-100">{done.readings.toLocaleString()}</dd>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide">Events</dt>
            <dd className="text-lg font-bold text-slate-900 dark:text-slate-100">{done.events.toLocaleString()}</dd>
          </div>
          <div className="col-span-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide">Date range</dt>
            <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">{done.start} – {done.end}</dd>
          </div>
        </dl>
        <button
          onClick={reset}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Upload another file
        </button>
      </div>
    )
  }

  // ── Confirm screen ──────────────────────────────────────────────────────────
  if (parsed) {
    const { readings, events, minTs, maxTs, fileName } = parsed
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700/60 p-6 max-w-sm mx-auto">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Confirm upload</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 truncate" title={fileName}>{fileName}</p>

        <dl className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide">Readings</dt>
            <dd className="text-lg font-bold text-slate-900 dark:text-slate-100">{readings.length.toLocaleString()}</dd>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide">Events</dt>
            <dd className="text-lg font-bold text-slate-900 dark:text-slate-100">{events.length.toLocaleString()}</dd>
          </div>
          <div className="col-span-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <dt className="text-[10px] text-slate-400 uppercase tracking-wide">Detected range</dt>
            <dd className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtDate(minTs)} – {fmtDate(maxTs)}</dd>
          </div>
        </dl>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Stint name
          </label>
          <input
            type="text"
            value={stintName}
            onChange={e => setStintName(e.target.value)}
            placeholder="e.g. Feb–Mar 2026"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {progress && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Uploading…</span>
              <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={reset}
            disabled={!!progress}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!!progress}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {progress ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    )
  }

  // ── Drop zone ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-sm mx-auto">
      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
      )}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`w-full rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
          dragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
      >
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {dragging ? 'Drop to upload' : 'Drop CSV here or click to browse'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Ultrahuman export format</p>
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  )
}
