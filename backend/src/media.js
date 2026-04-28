export async function downloadTwilioMedia(url, accountSid, authToken) {
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${credentials}` },
  })
  if (!res.ok) throw new Error(`Media download failed: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: contentType.split(';')[0].trim(),
  }
}
