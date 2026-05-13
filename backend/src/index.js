import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { handleWebhook } from './webhook.js'
import { getWhatsAppCode } from './api.js'

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_NUMBER',
]
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  console.error('Missing required env vars:', missing.join(', '))
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 3001

// Railway terminates TLS at the edge — without this, req.protocol is "http"
// and Twilio signature validation fails because Twilio signed against https://.
app.set('trust proxy', true)

const corsOptions = {
  origin: ['https://glucose-playbook.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))
// Explicitly handle preflight for all routes
app.options('*', cors(corsOptions))

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/health', (_, res) => res.json({ ok: true, time: Date.now() }))
app.get('/debug', (_, res) => res.json({
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
  hasTwilioToken: !!process.env.TWILIO_AUTH_TOKEN,
  twilioNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  skipTwilioValidation: process.env.SKIP_TWILIO_VALIDATION === 'true',
  nodeEnv: process.env.NODE_ENV,
}))
app.post('/webhook/whatsapp', handleWebhook)
app.post('/api/whatsapp-code/:userId', getWhatsAppCode)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on 0.0.0.0:${PORT}`)
  console.log(`CORS allowed origins:`, corsOptions.origin)
})
