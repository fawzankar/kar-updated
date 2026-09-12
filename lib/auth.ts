import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

export async function isOwner() {
  const secret = process.env.AUTH_SECRET
  if (!secret) return false
  const token = (await cookies()).get('fowzan_owner_session')?.value
  if (!token) return false
  const [value, signature] = token.split('.')
  if (!value || !signature) return false
  const expected = createHmac('sha256', secret).update(value).digest('hex')
  if (signature.length !== expected.length) return false
  const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  const timestamp = Number(value.split(':')[1])
  return valid && Number.isFinite(timestamp) && timestamp > Date.now() - 1000 * 60 * 60 * 24 * 7
}
