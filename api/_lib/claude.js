import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function safeParseJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
  const raw = match ? match[1].trim() : text.trim()
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const SYSTEM_FOOD = {
  type: 'text',
  text: `You are a food logging assistant for a CGM app. Parse food descriptions and return only valid JSON.

Schema: {"food_items": "comma-separated list of foods", "notes": "portion size or prep method, or null", "meal_type": "breakfast | lunch | dinner | snack, or null if the user did not say"}

Only set meal_type when the user explicitly names the meal ("for lunch", "had breakfast", "evening snack", "dinner was…"). Map "evening snack" / "afternoon snack" / "late night snack" → "snack". If unstated, return null — the server infers from the clock.

Examples:
- "had oatmeal with banana" → {"food_items": "oatmeal, banana", "notes": null, "meal_type": null}
- "for lunch had rice and dal" → {"food_items": "rice, dal", "notes": null, "meal_type": "lunch"}
- "evening snack: 2 biscuits" → {"food_items": "biscuits", "notes": "2", "meal_type": "snack"}
- "2 slices whole wheat toast with peanut butter" → {"food_items": "whole wheat toast, peanut butter", "notes": "2 slices", "meal_type": null}`,
  cache_control: { type: 'ephemeral' },
}

const SYSTEM_GLUCOSE = {
  type: 'text',
  text: `You are a glucose logging assistant for a CGM app. Extract glucose readings and return only valid JSON.

Schema: {"glucose_value": 120, "context": "before meal / after meal / fasting / or null"}

If no glucose value found, return {"glucose_value": null, "context": null}.`,
  cache_control: { type: 'ephemeral' },
}

const SYSTEM_INTENT = {
  type: 'text',
  text: 'Classify user message intent. Reply with exactly one word: food, glucose, help, or unknown.',
  cache_control: { type: 'ephemeral' },
}

export async function parseFoodText(text) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: [SYSTEM_FOOD],
    messages: [{ role: 'user', content: text }],
  })
  return safeParseJSON(msg.content[0].text)
}

export async function parseFoodImage(imageBase64, mimeType, caption) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
    { type: 'text', text: caption ? `${caption}\n\nWhat food is shown? Return JSON.` : 'What food is shown? Return JSON.' },
  ]
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: [SYSTEM_FOOD],
    messages: [{ role: 'user', content }],
  })
  return safeParseJSON(msg.content[0].text)
}

export async function parseGlucoseText(text) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 128,
    system: [SYSTEM_GLUCOSE],
    messages: [{ role: 'user', content: text }],
  })
  return safeParseJSON(msg.content[0].text)
}

export async function parseGlucoseImage(imageBase64, mimeType, caption) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
    { type: 'text', text: caption ? `${caption}\n\nWhat glucose reading is shown? Return JSON.` : 'What glucose reading is shown? Return JSON.' },
  ]
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 128,
    system: [SYSTEM_GLUCOSE],
    messages: [{ role: 'user', content }],
  })
  return safeParseJSON(msg.content[0].text)
}

export async function classifyIntent(text) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 16,
    system: [SYSTEM_INTENT],
    messages: [{ role: 'user', content: text }],
  })
  return msg.content[0].text.trim().toLowerCase()
}
