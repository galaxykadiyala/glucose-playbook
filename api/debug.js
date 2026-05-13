export default function handler(_req, res) {
  res.json({
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasTwilioSid: !!process.env.TWILIO_ACCOUNT_SID,
    hasTwilioToken: !!process.env.TWILIO_AUTH_TOKEN,
    twilioNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    skipTwilioValidation: process.env.SKIP_TWILIO_VALIDATION === 'true',
    vercelEnv: process.env.VERCEL_ENV,
  })
}
