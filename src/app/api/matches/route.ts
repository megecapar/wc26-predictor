/**
 * GET /api/matches
 * KV'den maç verisini döner — Next.js ISR ile cache'lenir
 */
import { NextResponse } from 'next/server'
import { getMatches, getLastUpdate } from '@/lib/kv'

export const revalidate = 300 // 5 dakikada bir yenile

export async function GET() {
  const [matches, lastUpdate] = await Promise.all([
    getMatches(),
    getLastUpdate(),
  ])
  return NextResponse.json({ matches, lastUpdate })
}
