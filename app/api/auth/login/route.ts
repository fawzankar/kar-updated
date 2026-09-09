import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = 'fowzan_owner_session'

function sign(value: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return createHmac('sha256', secret).update(value).digest('hex')
}

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: '' }))
  const configured = process.env.OWNER_PASSWORD
  if (!configured) return NextResponse.json({ error: 'Owner authentication is not configured yet.' }, { status: 503 })

  const supplied = String(password ?? '')
  const a = Buffer.from(supplied)
  const b = Buffer.from(configured)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const value = `owner:${Date.now()}`
  const token = `${value}.${sign(value)}`
  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return NextResponse.json({ authenticated: false })
  const [value, signature] = token.split('.')
  if (!value || !signature) return NextResponse.json({ authenticated: false })
  const expected = sign(value)
  const valid = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  const timestamp = Number(value.split(':')[1])
  const fresh = Number.isFinite(timestamp) && timestamp > Date.now() - 1000 * 60 * 60 * 24 * 7
  return NextResponse.json({ authenticated: valid && fresh })
}
