import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { handleWebhook } from './webhook.js'
import { getWhatsAppCode } from './api.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: ['https://glucose-playbook.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/health', (_, res) => res.json({ ok: true }))
app.post('/webhook/whatsapp', handleWebhook)
app.post('/api/whatsapp-code/:userId', getWhatsAppCode)

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
