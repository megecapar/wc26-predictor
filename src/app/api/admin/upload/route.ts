/**
 * POST /api/admin/upload
 * matches_real.json içeriğini Blob'a yükler
 *
 * Kullanım:
 *   curl -X POST https://wc26-predictor-orcin.vercel.app/api/admin/upload \
 *     -H "Authorization: Bearer wc26secret2026" \
 *     -H "Content-Type: application/json" \
 *     -d @src/data/matches_real.json
 */

import { NextRequest, NextResponse } from 'next/server'
import { setMatches, setLastUpdate } from '@/lib/blob'
import { revalidatePath } from 'next/cache'
import { MatchPrediction } from '@/lib/types'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const matches = await req.json() as MatchPrediction[]

    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ error: 'Geçersiz veri — boş array' }, { status: 400 })
    }

    await setMatches(matches)
    await setLastUpdate(new Date().toISOString())
    revalidatePath('/')

    return NextResponse.json({
      success: true,
      count: matches.length,
      message: `${matches.length} maç Blob'a yüklendi`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
