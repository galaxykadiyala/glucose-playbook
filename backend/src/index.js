import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { handleWebhook } from './webhook.js'
import { getWhatsAppCode } from './api.js'

const app = express()
const PORT = process.env.PORT || 3001

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
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
  hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
  twilioNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  nodeEnv: process.env.NODE_ENV,
}))
app.post('/webhook/whatsapp', handleWebhook)
app.post('/api/whatsapp-code/:userId', getWhatsAppCode)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on 0.0.0.0:${PORT}`)
  console.log(`CORS allowed origins:`, corsOptions.origin)
})
