import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const { MAILCHIMP_API_KEY, MAILCHIMP_LIST_ID, MAILCHIMP_SERVER_PREFIX } = process.env

  if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID || !MAILCHIMP_SERVER_PREFIX) {
    console.error('Mailchimp env vars missing')
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `apikey ${MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_address: email, status: 'subscribed' }),
      }
    )

    if (!res.ok) {
      if (res.status === 400) {
        const body = await res.json()
        if (body.title !== 'Member Exists') {
          return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
      }
    }
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
