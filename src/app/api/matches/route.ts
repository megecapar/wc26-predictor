import { NextResponse } from 'next/server'
import { getMatches, getLastUpdate } from '@/lib/blob'

export const revalidate = 300

export async function GET() {
  const [matches, lastUpdate] = await Promise.all([
    getMatches(),
    getLastUpdate(),
  ])
  return NextResponse.json({ matches, lastUpdate })
}
