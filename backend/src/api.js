import { supabase } from './supabase.js'

// Unambiguous chars: no 0/O/1/I/l
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

export async function getWhatsAppCode(req, res) {
  const { userId } = req.params
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user || user.id !== userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data: existing } = await supabase
    .from('user_whatsapp_links')
    .select('link_code, whatsapp_number, linked_at')
    .eq('user_id', userId)
    .single()

  // Strip "whatsapp:" prefix for display — e.g. "whatsapp:+14155238886" → "+14155238886"
  const twilioRaw = process.env.TWILIO_WHATSAPP_NUMBER || ''
  const whatsappNumber = twilioRaw.replace(/^whatsapp:/i, '')

  if (existing?.whatsapp_number) {
    return res.json({ linked: true, whatsapp_number: whatsappNumber, linked_from: existing.whatsapp_number, linked_at: existing.linked_at })
  }

  if (existing) {
    return res.json({ linked: false, code: existing.link_code, whatsapp_number: whatsappNumber })
  }

  const code = generateCode()
  await supabase.from('user_whatsapp_links').insert({ user_id: userId, link_code: code })
  return res.json({ linked: false, code, whatsapp_number: whatsappNumber })
}
