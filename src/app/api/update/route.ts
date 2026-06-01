/**
 * POST /api/update
 * Header: x-update-secret: <UPDATE_SECRET env var>
 *
 * Kullanım (terminalde):
 *   curl -X POST http://localhost:3000/api/update \
 *        -H "x-update-secret: mysecret"
 *
 * Ya da cron ile:
 *   0 2 * * * curl -s -X POST https://wc26.yourdomain.com/api/update -H "x-update-secret: $SECRET"
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import path from 'path'

const SECRET = process.env.UPDATE_SECRET ?? 'dev'

export async function POST(req: NextRequest) {
  // Basit secret koruması
  const secret = req.headers.get('x-update-secret')
  if (secret !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'update_live.py')

  return new Promise<NextResponse>((resolve) => {
    exec(
      `python3 "${scriptPath}"`,
      {
        env: {
          ...process.env,
          API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY ?? '',
        },
        timeout: 30_000,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[update] Script hatası:', stderr)
          resolve(
            NextResponse.json(
              { success: false, error: stderr },
              { status: 500 }
            )
          )
        } else {
          console.log('[update] ✓', stdout.slice(-200))
          resolve(
            NextResponse.json({ success: true, log: stdout.slice(-500) })
          )
        }
      }
    )
  })
}
