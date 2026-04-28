import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { handleWebhook } from './webhook.js'
import { getWhatsAppCode } from './api.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/health', (_, res) => res.json({ ok: true }))
app.post('/webhook/whatsapp', handleWebhook)
app.get('/api/whatsapp-code/:userId', getWhatsAppCode)

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
