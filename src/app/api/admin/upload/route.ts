import { NextRequest, NextResponse } from 'next/server'
import { setMatches, setLastUpdate } from '@/lib/blob'
import { revalidatePath } from 'next/cache'
import { MatchPrediction } from '@/lib/types'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const matches = await req.json() as MatchPrediction[]
    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
    }
    await setMatches(matches)
    await setLastUpdate(new Date().toISOString())
    revalidatePath('/')
    revalidatePath('/bracket')
    revalidatePath('/standings')
    return NextResponse.json({ success: true, count: matches.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
