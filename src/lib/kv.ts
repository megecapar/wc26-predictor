/**
 * Vercel KV wrapper
 * Lokalde: matches_real.json'dan okur
 * Prod'da: Redis KV'den okur
 */

import { MatchPrediction } from '@/lib/types'

const IS_PROD = process.env.KV_REST_API_URL !== undefined

// ── KV okuma/yazma ────────────────────────────────────────────────────────────
async function kvGet<T>(key: string): Promise<T | null> {
  if (!IS_PROD) return null
  const { kv } = await import('@vercel/kv')
  return kv.get<T>(key)
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (!IS_PROD) return
  const { kv } = await import('@vercel/kv')
  await kv.set(key, value)
}

// ── Maç verisi ────────────────────────────────────────────────────────────────
export async function getMatches(): Promise<MatchPrediction[]> {
  // Prod: KV'den oku
  if (IS_PROD) {
    const cached = await kvGet<MatchPrediction[]>('matches')
    if (cached && cached.length > 0) return cached
  }

  // Lokal veya KV boşsa: JSON dosyasından oku
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@/data/matches_real.json') as MatchPrediction[]
}

export async function setMatches(matches: MatchPrediction[]): Promise<void> {
  await kvSet('matches', matches)
}

// ── ELO ──────────────────────────────────────────────────────────────────────
export async function getElo(): Promise<Record<string, number>> {
  return (await kvGet<Record<string, number>>('elo')) ?? {}
}

export async function setElo(elo: Record<string, number>): Promise<void> {
  await kvSet('elo', elo)
}

// ── Son güncelleme ────────────────────────────────────────────────────────────
export async function getLastUpdate(): Promise<string | null> {
  return kvGet<string>('last_update')
}

export async function setLastUpdate(time: string): Promise<void> {
  await kvSet('last_update', time)
}

// ── Biten maçlar cache ────────────────────────────────────────────────────────
export type FinishedMatch = {
  home: string; away: string
  homeScore: number; awayScore: number
  date: string
}

export async function getFinishedMatches(): Promise<FinishedMatch[]> {
  return (await kvGet<FinishedMatch[]>('finished_matches')) ?? []
}

export async function setFinishedMatches(matches: FinishedMatch[]): Promise<void> {
  await kvSet('finished_matches', matches)
}
