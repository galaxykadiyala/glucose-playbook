import { useEffect, useState } from 'react'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'

export default function WhatsAppConnect() {
  const { user } = useUser()
  const [state, setState] = useState({ loading: true, error: null, linked: false, code: null, twilioNumber: null, whatsappNumber: null })

  useEffect(() => {
    if (!user) return
    fetchCode()
  }, [user])

  async function fetchCode() {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/whatsapp-code/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setState({ loading: false, error: null, linked: data.linked, code: data.code ?? null, twilioNumber: data.twilio_number ?? null, whatsappNumber: data.whatsapp_number ?? null })
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }))
    }
  }

  const phoneNumber = state.twilioNumber?.replace('whatsapp:', '') ?? ''
  const waLink = phoneNumber ? `https://wa.me/${phoneNumber.replace('+', '')}?text=${encodeURIComponent(state.code ?? '')}` : null

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">WhatsApp Logging</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Log meals and glucose readings directly from WhatsApp — no app-switching needed.
        </p>
      </div>

      {state.loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      )}

      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
          {state.error}
          <button onClick={fetchCode} className="ml-2 underline">Retry</button>
        </div>
      )}

      {!state.loading && !state.error && state.linked && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">WhatsApp connected</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Linked from <span className="font-mono font-medium">{state.whatsappNumber}</span>
          </p>
          <div className="pt-1 border-t border-emerald-200 dark:border-emerald-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">What you can send</p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>• Food: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">had oatmeal with banana</span></li>
              <li>• Glucose: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">glucose 95</span></li>
              <li>• Photo of food or your glucose meter</li>
            </ul>
          </div>
        </div>
      )}

      {!state.loading && !state.error && !state.linked && state.code && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Step 1</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-4">
              Open WhatsApp and message <span className="font-mono font-bold">{phoneNumber || 'the Twilio number'}</span>
            </p>

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Step 2</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-3">Send this code exactly:</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-blue-600 dark:text-blue-400 select-all">
                {state.code}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(state.code)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#20c25c] text-white font-semibold rounded-xl transition-colors text-sm"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Open in WhatsApp
            </a>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Once you send the code, this page will show your connection status.
            <button onClick={fetchCode} className="ml-1 underline">Refresh</button>
          </p>
        </div>
      )}
    </div>
  )
}
