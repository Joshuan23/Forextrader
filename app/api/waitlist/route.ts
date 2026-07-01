import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const { MAILCHIMP_API_KEY, MAILCHIMP_LIST_ID, MAILCHIMP_SERVER_PREFIX } = process.env

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

    if (!res.ok && res.status !== 400) {
      // 400 = already subscribed — treat as success
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
