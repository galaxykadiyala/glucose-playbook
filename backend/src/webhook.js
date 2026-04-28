import twilio from 'twilio'
import { supabase } from './supabase.js'
import { parseFoodText, parseFoodImage, parseGlucoseText, parseGlucoseImage, classifyIntent } from './claude.js'
import { downloadTwilioMedia } from './media.js'

const LINK_CODE_RE = /^[A-Z0-9]{6}$/i
const GLUCOSE_PATTERN = /\b(?:glucose|blood sugar|sugar|bs|bg)\s*[:\s]\s*(\d{2,3})\b/i
const FOOD_KEYWORDS = /\b(?:ate|had|eat|meal|food|drink|drank|breakfast|lunch|dinner|snack|coffee|tea)\b/i

function twiml(text) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${text}</Message></Response>`
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
  console.log('Link attempt:', { rawCode: code, normalizedCode: normalized, whatsappNumber })

  // First check the code exists (allows re-linking from a different number)
  const { data: existing, error: lookupError } = await supabase
    .from('user_whatsapp_links')
    .select('user_id, whatsapp_number')
    .eq('link_code', normalized)
    .single()

  console.log('DB lookup result:', { existing, lookupError })

  if (lookupError || !existing) {
    return twiml('Invalid code. Please generate a fresh code in the Glucose Decode app.')
  }

  const { error: updateError } = await supabase
    .from('user_whatsapp_links')
    .update({ whatsapp_number: whatsappNumber, linked_at: new Date().toISOString() })
    .eq('link_code', normalized)

  console.log('DB update result:', { updateError })

  if (updateError) {
    return twiml('Could not link your number. Please try again.')
  }
  return twiml('✅ WhatsApp linked! Send me what you ate or a glucose reading anytime.')
}

async function logFood(userId, parsed) {
  if (!parsed?.food_items) return null
  const { error } = await supabase.from('meal_logs').insert({
    user_id: userId,
    timestamp: new Date().toISOString(),
    food_items: parsed.food_items,
    notes: parsed.notes ?? null,
    source: 'whatsapp',
  })
  return error ? null : parsed
}

async function logGlucose(userId, parsed) {
  if (!parsed?.glucose_value) return null
  const { error } = await supabase.from('manual_glucose').insert({
    user_id: userId,
    timestamp: new Date().toISOString(),
    glucose_value: parsed.glucose_value,
    context: parsed.context ?? null,
    source: 'whatsapp',
  })
  return error ? null : parsed
}

export async function handleWebhook(req, res) {
  // TODO: Re-enable Twilio signature validation once basic flow is verified
  // const valid = twilio.validateRequest(
  //   process.env.TWILIO_AUTH_TOKEN,
  //   req.headers['x-twilio-signature'] || '',
  //   `${req.protocol}://${req.get('host')}${req.originalUrl}`,
  //   req.body
  // )
  // if (!valid) return res.status(403).send('Forbidden')

  const body = (req.body.Body || '').trim()
  const from = req.body.From || ''
  const numMedia = parseInt(req.body.NumMedia || '0', 10)
  const mediaUrl = req.body.MediaUrl0

  console.log('Webhook hit:', { from, body, numMedia })

  res.type('text/xml')

  // Link code
  if (LINK_CODE_RE.test(body)) {
    return res.send(await handleLinkCode(body, from))
  }

  // Require linked account for everything else
  const userLink = await getUserByWhatsApp(from)
  if (!userLink) {
    return res.send(twiml(
      'Your WhatsApp is not linked. Open the Glucose Decode app, go to WhatsApp Connect, and send the 6-character code shown there.'
    ))
  }
  const userId = userLink.user_id

  if (/^help$/i.test(body)) {
    return res.send(twiml(
      'What I can log:\n• Food: "had rice and dal"\n• Glucose: "glucose 110"\n• Photo of food or your glucose meter'
    ))
  }

  // Image handling
  if (numMedia > 0 && mediaUrl) {
    try {
      const { base64, mimeType } = await downloadTwilioMedia(
        mediaUrl,
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )

      if (/glucose|blood sugar|mg|mmol|reading|meter/i.test(body)) {
        const parsed = await parseGlucoseImage(base64, mimeType, body)
        if (parsed?.glucose_value) {
          await logGlucose(userId, parsed)
          return res.send(twiml(`Logged glucose: ${parsed.glucose_value} mg/dL${parsed.context ? ` (${parsed.context})` : ''} ✓`))
        }
      }

      const parsed = await parseFoodImage(base64, mimeType, body)
      if (parsed?.food_items) {
        await logFood(userId, parsed)
        return res.send(twiml(`Logged meal: ${parsed.food_items}${parsed.notes ? ` — ${parsed.notes}` : ''} ✓`))
      }

      return res.send(twiml("Couldn't identify food or glucose in that image. Try a clearer photo or describe it in text."))
    } catch (err) {
      console.error('Media error:', err)
      return res.send(twiml('Error processing the image. Please try again.'))
    }
  }

  // Quick glucose pattern: "glucose 95" or "bg: 110"
  const glucoseMatch = body.match(GLUCOSE_PATTERN)
  if (glucoseMatch) {
    const value = parseInt(glucoseMatch[1], 10)
    await logGlucose(userId, { glucose_value: value, context: null })
    return res.send(twiml(`Logged glucose: ${value} mg/dL ✓`))
  }

  // Claude intent + parse
  const intent = await classifyIntent(body)

  if (intent === 'glucose') {
    const parsed = await parseGlucoseText(body)
    if (parsed?.glucose_value) {
      await logGlucose(userId, parsed)
      return res.send(twiml(`Logged glucose: ${parsed.glucose_value} mg/dL${parsed.context ? ` (${parsed.context})` : ''} ✓`))
    }
  }

  if (intent === 'food' || FOOD_KEYWORDS.test(body)) {
    const parsed = await parseFoodText(body)
    if (parsed?.food_items) {
      await logFood(userId, parsed)
      return res.send(twiml(`Logged meal: ${parsed.food_items}${parsed.notes ? ` — ${parsed.notes}` : ''} ✓`))
    }
  }

  return res.send(twiml(
    "Not sure what to log. Try:\n• \"had oatmeal and eggs\"\n• \"glucose 95\"\n• Send a photo of your food or meter"
  ))
}
