import twilio from 'twilio'
import { supabase } from '../_lib/supabase.js'
import { parseFoodText, parseFoodImage, parseGlucoseText, parseGlucoseImage, classifyIntent } from '../_lib/claude.js'
import { downloadTwilioMedia } from '../_lib/media.js'

const LINK_CODE_RE = /^[A-Z0-9]{6}$/i
const GLUCOSE_PATTERN = /\b(?:glucose|blood sugar|sugar|bs|bg)\s*[:\s]\s*(\d{2,3})\b/i
const FOOD_KEYWORDS = /\b(?:ate|had|eat|meal|food|drink|drank|breakfast|lunch|dinner|snack|coffee|tea)\b/i

function maskNumber(n) {
  if (!n) return n
  return n.replace(/(\+?\d{1,3})\d+(\d{2})/, '$1***$2')
}

function twiml(text) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${text}</Message></Response>`
}

function sendTwiml(res, xml) {
  res.setHeader('Content-Type', 'text/xml')
  return res.status(200).send(xml)
}

async function getUserByWhatsApp(whatsappNumber) {
  const { data } = await supabase
    .from('user_whatsapp_links')
    .select('user_id')
    .eq('whatsapp_number', whatsappNumber)
    .single()
  return data
}

async function handleLinkCode(code, whatsappNumber) {
  const normalized = code.trim().toUpperCase()
  console.log('Link attempt:', { code: normalized, from: maskNumber(whatsappNumber) })

  const { data: existing, error: lookupError } = await supabase
    .from('user_whatsapp_links')
    .select('user_id, whatsapp_number')
    .eq('link_code', normalized)
    .single()

  if (lookupError || !existing) {
    console.log('Link lookup miss', { code: normalized, err: lookupError?.code })
    return twiml('Invalid code. Please generate a fresh code in the Glucose Decode app.')
  }

  // Clear whatsapp_number on any OTHER row that owns it — otherwise the
  // unique constraint on user_whatsapp_links.whatsapp_number blocks the
  // UPDATE below with Postgres error 23505. Orphans the old link by design.
  const { error: unlinkError, count: unlinkCount } = await supabase
    .from('user_whatsapp_links')
    .update({ whatsapp_number: null, linked_at: null }, { count: 'exact' })
    .eq('whatsapp_number', whatsappNumber)
    .neq('link_code', normalized)

  if (unlinkError) {
    console.error('Unlink prior owner failed', {
      code: unlinkError.code,
      message: unlinkError.message,
      details: unlinkError.details,
      hint: unlinkError.hint,
    })
  } else if (unlinkCount) {
    console.log('Cleared prior link rows', { count: unlinkCount })
  }

  const { error: updateError, data: updatedRows } = await supabase
    .from('user_whatsapp_links')
    .update({ whatsapp_number: whatsappNumber, linked_at: new Date().toISOString() })
    .eq('link_code', normalized)
    .select()

  if (updateError) {
    console.error('Link update failed', {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    })
    return twiml('Could not link your number. Please try again.')
  }
  if (!updatedRows?.length) {
    console.error('Link update affected 0 rows', { linkCode: normalized })
    return twiml('Could not link your number. Please try again.')
  }
  return twiml('✅ WhatsApp linked! Send me what you ate or a glucose reading anytime.')
}

async function logFood(userId, parsed) {
  if (!parsed?.food_items) return { ok: false, reason: 'no_food' }
  const { error } = await supabase.from('meal_logs').insert({
    user_id: userId,
    timestamp: new Date().toISOString(),
    food_items: parsed.food_items,
    notes: parsed.notes ?? null,
    source: 'whatsapp',
  })
  if (error) {
    console.error('meal_logs insert failed', { err: error.message })
    return { ok: false, reason: 'db_error' }
  }
  return { ok: true }
}

async function logGlucose(userId, parsed) {
  if (!parsed?.glucose_value) return { ok: false, reason: 'no_value' }
  const { error } = await supabase.from('manual_glucose').insert({
    user_id: userId,
    timestamp: new Date().toISOString(),
    glucose_value: parsed.glucose_value,
    context: parsed.context ?? null,
    source: 'whatsapp',
  })
  if (error) {
    console.error('manual_glucose insert failed', { err: error.message })
    return { ok: false, reason: 'db_error' }
  }
  return { ok: true }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Method Not Allowed')
  }

  // Build the public URL Twilio signed against. Vercel terminates TLS at the
  // edge — req.url is just the path, so we synthesize the full URL from
  // forwarded headers.
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers['host']
  const url = `${proto}://${host}${req.url}`
  const signature = req.headers['x-twilio-signature'] || ''

  if (process.env.SKIP_TWILIO_VALIDATION === 'true') {
    console.warn('Twilio signature check SKIPPED — SKIP_TWILIO_VALIDATION=true')
  } else {
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      req.body
    )
    if (!valid) {
      console.warn('Twilio signature invalid', {
        computedUrl: url,
        hasSignature: !!signature,
        bodyKeys: Object.keys(req.body || {}),
      })
      return res.status(403).send('Forbidden')
    }
  }

  const body = (req.body?.Body || '').trim()
  const from = req.body?.From || ''
  const numMedia = parseInt(req.body?.NumMedia || '0', 10)
  const mediaUrl = req.body?.MediaUrl0

  console.log('Webhook hit:', { from: maskNumber(from), bodyLen: body.length, numMedia })

  if (LINK_CODE_RE.test(body)) {
    return sendTwiml(res, await handleLinkCode(body, from))
  }

  const userLink = await getUserByWhatsApp(from)
  if (!userLink) {
    return sendTwiml(res, twiml(
      'Your WhatsApp is not linked. Open the Glucose Decode app, go to WhatsApp Connect, and send the 6-character code shown there.'
    ))
  }
  const userId = userLink.user_id

  if (/^help$/i.test(body)) {
    return sendTwiml(res, twiml(
      'What I can log:\n• Food: "had rice and dal"\n• Glucose: "glucose 110"\n• Photo of food or your glucose meter'
    ))
  }

  if (numMedia > 0 && mediaUrl) {
    try {
      const { base64, mimeType } = await downloadTwilioMedia(
        mediaUrl,
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )

      if (/glucose|blood sugar|mg|mmol|reading|meter/i.test(body)) {
        const parsed = await parseGlucoseImage(base64, mimeType, body).catch(err => {
          console.error('parseGlucoseImage failed', { err: err.message })
          return null
        })
        if (parsed?.glucose_value) {
          const result = await logGlucose(userId, parsed)
          if (!result.ok) return sendTwiml(res, twiml('Read your glucose but couldn\'t save it. Please try again.'))
          return sendTwiml(res, twiml(`Logged glucose: ${parsed.glucose_value} mg/dL${parsed.context ? ` (${parsed.context})` : ''} ✓`))
        }
      }

      const parsed = await parseFoodImage(base64, mimeType, body).catch(err => {
        console.error('parseFoodImage failed', { err: err.message })
        return null
      })
      if (parsed?.food_items) {
        const result = await logFood(userId, parsed)
        if (!result.ok) return sendTwiml(res, twiml('Read your meal but couldn\'t save it. Please try again.'))
        return sendTwiml(res, twiml(`Logged meal: ${parsed.food_items}${parsed.notes ? ` — ${parsed.notes}` : ''} ✓`))
      }

      return sendTwiml(res, twiml("Couldn't identify food or glucose in that image. Try a clearer photo or describe it in text."))
    } catch (err) {
      console.error('Media error:', err.message)
      return sendTwiml(res, twiml('Error processing the image. Please try again.'))
    }
  }

  const glucoseMatch = body.match(GLUCOSE_PATTERN)
  if (glucoseMatch) {
    const value = parseInt(glucoseMatch[1], 10)
    const result = await logGlucose(userId, { glucose_value: value, context: null })
    if (!result.ok) return sendTwiml(res, twiml('Couldn\'t save your glucose reading. Please try again.'))
    return sendTwiml(res, twiml(`Logged glucose: ${value} mg/dL ✓`))
  }

  let intent = 'unknown'
  try {
    intent = await classifyIntent(body)
  } catch (err) {
    console.error('classifyIntent failed', { err: err.message })
    return sendTwiml(res, twiml('Having trouble understanding right now. Please try again in a moment.'))
  }

  if (intent === 'glucose') {
    const parsed = await parseGlucoseText(body).catch(err => {
      console.error('parseGlucoseText failed', { err: err.message })
      return null
    })
    if (parsed?.glucose_value) {
      const result = await logGlucose(userId, parsed)
      if (!result.ok) return sendTwiml(res, twiml('Couldn\'t save your glucose reading. Please try again.'))
      return sendTwiml(res, twiml(`Logged glucose: ${parsed.glucose_value} mg/dL${parsed.context ? ` (${parsed.context})` : ''} ✓`))
    }
  }

  if (intent === 'food' || FOOD_KEYWORDS.test(body)) {
    const parsed = await parseFoodText(body).catch(err => {
      console.error('parseFoodText failed', { err: err.message })
      return null
    })
    if (parsed?.food_items) {
      const result = await logFood(userId, parsed)
      if (!result.ok) return sendTwiml(res, twiml('Couldn\'t save your meal. Please try again.'))
      return sendTwiml(res, twiml(`Logged meal: ${parsed.food_items}${parsed.notes ? ` — ${parsed.notes}` : ''} ✓`))
    }
  }

  return sendTwiml(res, twiml(
    "Not sure what to log. Try:\n• \"had oatmeal and eggs\"\n• \"glucose 95\"\n• Send a photo of your food or meter"
  ))
}
