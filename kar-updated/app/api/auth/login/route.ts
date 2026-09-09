import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = 'fowzan_owner_session'

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function getSecret() {
  return process.env.AUTH_SECRET?.trim() || ''
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export async function POST(request: Request) {
  try {
    const configured = process.env.OWNER_PASSWORD?.trim()
    const secret = getSecret()

    if (!configured || !secret) {
      return json({
        error: 'Owner authentication is not fully configured. Please set OWNER_PASSWORD and AUTH_SECRET in Vercel.'
      }, 503)
    }

    let body: { password?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid login request.' }, 400)
    }

    const supplied = String(body.password ?? '')
    const a = Buffer.from(supplied)
    const b = Buffer.from(configured)

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return json({ error: 'Incorrect password.' }, 401)
    }

    const value = `owner:${Date.now()}`
    const token = `${value}.${sign(value, secret)}`
    const store = await cookies()

    store.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return json({ ok: true })
  } catch {
    return json({ error: 'Unable to sign in right now. Please try again.' }, 500)
  }
}

export async function GET() {
  try {
    const secret = getSecret()
    if (!secret) return json({ authenticated: false, configured: false })

    const store = await cookies()
    const token = store.get(COOKIE)?.value
    if (!token) return json({ authenticated: false, configured: true })

    const [value, signature] = token.split('.')
    if (!value || !signature) return json({ authenticated: false, configured: true })

    const expected = sign(value, secret)
    const valid =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected))

    const timestamp = Number(value.split(':')[1])
    const fresh =
      Number.isFinite(timestamp) &&
      timestamp > Date.now() - 1000 * 60 * 60 * 24 * 7

    return json({ authenticated: valid && fresh, configured: true })
  } catch {
    return json({ authenticated: false, configured: false })
  }
}
