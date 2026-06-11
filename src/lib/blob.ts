/**
 * Vercel Blob wrapper
 * Lokalde: matches_real.json'dan okur
 * Prod'da: Vercel Blob'dan okur/yazar
 */

import { MatchPrediction } from '@/lib/types'

const IS_PROD = !!process.env.BLOB_READ_WRITE_TOKEN

// Bellek içi cache — Blob'a gereksiz istek atmayı önler
let matchesCache: MatchPrediction[] | null = null
let matchesCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 dakika

const MATCHES_KEY     = 'wc26/matches.json'
const ELO_KEY         = 'wc26/elo.json'
const FINISHED_KEY    = 'wc26/finished.json'
const LAST_UPDATE_KEY = 'wc26/last_update.json'

// ── Blob okuma ────────────────────────────────────────────────────────────────
async function blobGet<T>(key: string): Promise<T | null> {
  try {
    const { list } = await import('@vercel/blob')
    const { blobs } = await list({ prefix: key })
    if (!blobs.length) return null
    const res = await fetch(blobs[0].url, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch { return null }
}

// ── Blob yazma ────────────────────────────────────────────────────────────────
async function blobSet(key: string, value: unknown): Promise<void> {
  const { put } = await import('@vercel/blob')
  await put(key, JSON.stringify(value), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  })
}

// ── Maç verisi ────────────────────────────────────────────────────────────────
export async function getMatches(): Promise<MatchPrediction[]> {
  // Bellek cache'i kontrol et
  if (matchesCache && Date.now() - matchesCacheTime < CACHE_TTL) {
    return matchesCache
  }
  if (IS_PROD) {
    const cached = await blobGet<MatchPrediction[]>(MATCHES_KEY)
    if (cached && cached.length > 0) {
      matchesCache = cached
      matchesCacheTime = Date.now()
      return cached
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const data = require('@/data/matches_real.json') as MatchPrediction[]
  matchesCache = data
  matchesCacheTime = Date.now()
  return data
}

export async function setMatches(matches: MatchPrediction[]): Promise<void> {
  matchesCache = matches
  matchesCacheTime = Date.now()
  await blobSet(MATCHES_KEY, matches)
}

// ── ELO ──────────────────────────────────────────────────────────────────────
export async function getElo(): Promise<Record<string, number>> {
  return (await blobGet<Record<string, number>>(ELO_KEY)) ?? {}
}

export async function setElo(elo: Record<string, number>): Promise<void> {
  await blobSet(ELO_KEY, elo)
}

// ── Son güncelleme ────────────────────────────────────────────────────────────
export async function getLastUpdate(): Promise<string | null> {
  const data = await blobGet<{ time: string }>(LAST_UPDATE_KEY)
  return data?.time ?? null
}

export async function setLastUpdate(time: string): Promise<void> {
  await blobSet(LAST_UPDATE_KEY, { time })
}

// ── Biten maçlar ─────────────────────────────────────────────────────────────
export type FinishedMatch = {
  home: string; away: string
  homeScore: number; awayScore: number
  date: string
}

export async function getFinishedMatches(): Promise<FinishedMatch[]> {
  return (await blobGet<FinishedMatch[]>(FINISHED_KEY)) ?? []
}

export async function setFinishedMatches(matches: FinishedMatch[]): Promise<void> {
  await blobSet(FINISHED_KEY, matches)
}
