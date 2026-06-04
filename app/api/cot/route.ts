import { NextRequest, NextResponse } from 'next/server'
import { fetchCOT } from '@/lib/cot/cftc'

export async function GET(request: NextRequest) {
  const pair = new URL(request.url).searchParams.get('pair')
  if (!pair) {
    return NextResponse.json({ error: 'pair query parameter is required' }, { status: 400 })
  }

  try {
    const report = await fetchCOT(pair)
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch COT data' },
      { status: 500 }
    )
  }
}
