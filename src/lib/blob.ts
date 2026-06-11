/**
 * Vercel Blob wrapper
 * OKUMA: önce bellek cache → JSON dosyası (hızlı)
 * YAZMA: Blob'a yaz + cache güncelle
 */

import { MatchPrediction } from '@/lib/types'

const IS_PROD = !!process.env.BLOB_READ_WRITE_TOKEN

const MATCHES_KEY     = 'wc26/matches.json'
const ELO_KEY         = 'wc26/elo.json'
const FINISHED_KEY    = 'wc26/finished.json'
const LAST_UPDATE_KEY = 'wc26/last_update.json'

// Bellek cache
const cache: Record<string, { data: unknown; ts: number }> = {}
const TTL = 5 * 60 * 1000 // 5 dakika

function cacheGet<T>(key: string): T | null {
  const c = cache[key]
  if (c && Date.now() - c.ts < TTL) return c.data as T
  return null
}
function cacheSet(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() }
}

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
  // 1. Bellek cache
  const mem = cacheGet<MatchPrediction[]>(MATCHES_KEY)
  if (mem) return mem

  // 2. Prod'da Blob'dan çek
  if (IS_PROD) {
    const blob = await blobGet<MatchPrediction[]>(MATCHES_KEY)
    if (blob?.length) {
      cacheSet(MATCHES_KEY, blob)
      return blob
    }
  }

  // 3. Fallback: statik JSON (en hızlı)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const data = require('@/data/matches_real.json') as MatchPrediction[]
  cacheSet(MATCHES_KEY, data)
  return data
}

export async function setMatches(matches: MatchPrediction[]): Promise<void> {
  cacheSet(MATCHES_KEY, matches)
  await blobSet(MATCHES_KEY, matches)
}

// ── ELO ──────────────────────────────────────────────────────────────────────
export async function getElo(): Promise<Record<string, number>> {
  const mem = cacheGet<Record<string, number>>(ELO_KEY)
  if (mem) return mem
  const data = (await blobGet<Record<string, number>>(ELO_KEY)) ?? {}
  cacheSet(ELO_KEY, data)
  return data
}

export async function setElo(elo: Record<string, number>): Promise<void> {
  cacheSet(ELO_KEY, elo)
  await blobSet(ELO_KEY, elo)
}

// ── Son güncelleme ────────────────────────────────────────────────────────────
export async function getLastUpdate(): Promise<string | null> {
  const mem = cacheGet<{ time: string }>(LAST_UPDATE_KEY)
  if (mem) return mem.time
  const data = await blobGet<{ time: string }>(LAST_UPDATE_KEY)
  if (data) cacheSet(LAST_UPDATE_KEY, data)
  return data?.time ?? null
}

export async function setLastUpdate(time: string): Promise<void> {
  cacheSet(LAST_UPDATE_KEY, { time })
  await blobSet(LAST_UPDATE_KEY, { time })
}

// ── Biten maçlar ─────────────────────────────────────────────────────────────
export type FinishedMatch = {
  home: string; away: string
  homeScore: number; awayScore: number
  date: string
}

export async function getFinishedMatches(): Promise<FinishedMatch[]> {
  const mem = cacheGet<FinishedMatch[]>(FINISHED_KEY)
  if (mem) return mem
  const data = (await blobGet<FinishedMatch[]>(FINISHED_KEY)) ?? []
  cacheSet(FINISHED_KEY, data)
  return data
}

export async function setFinishedMatches(matches: FinishedMatch[]): Promise<void> {
  cacheSet(FINISHED_KEY, matches)
  await blobSet(FINISHED_KEY, matches)
}
