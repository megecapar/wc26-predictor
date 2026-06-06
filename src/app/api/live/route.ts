/**
 * GET /api/live
 * Auth'suz — frontend her 5 dakikada bir çağırır
 * Bugün maç yoksa hemen döner (API isteği atmaz)
 */

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getMatches, setMatches, setLastUpdate } from '@/lib/blob'
import { MatchPrediction } from '@/lib/types'

const API_KEY = process.env.API_FOOTBALL_KEY ?? ''

async function apiFetch(endpoint: string) {
  const res = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}`)
  return res.json()
}

async function getTodayFixtures() {
  const today = new Date().toISOString().slice(0, 10)
  const data  = await apiFetch(`fixtures?league=1&season=2026&date=${today}`)
  return data.response ?? []
}

async function getFixtureEvents(fixtureId: number) {
  const data = await apiFetch(`fixtures/events?fixture=${fixtureId}`)
  return data.response ?? []
}

async function getMissingPlayers(fixtureId: number) {
  try {
    const data = await apiFetch(`injuries?fixture=${fixtureId}`)
    const injuries = data.response ?? []
    let home = 0, away = 0
    for (const inj of injuries) {
      const mins = inj.player?.statistics?.[0]?.games?.minutes ?? 0
      if (mins > 500) {
        if (inj.team?.id === injuries[0]?.teams?.home?.id) home++
        else away++
      }
    }
    return { home, away }
  } catch { return { home: 0, away: 0 } }
}

interface ApiEvent {
  type: string; detail: string
  team: { name: string }
  time: { elapsed: number }
}

function calcLambdas(
  eH: number, eA: number,
  events: ApiEvent[], homeName: string,
  elapsed: number, missing: { home: number, away: number },
  isLive: boolean
) {
  const diff = eH - eA
  const fac  = 10 ** (diff / 400)
  let lh = Math.min(Math.max(1.3 * fac ** 0.5, 0.4), 4.0)
  let la = Math.min(Math.max(1.3 / fac ** 0.5, 0.4), 4.0)

  // Eksik oyuncu etkisi
  lh *= Math.max(1 - missing.home * 0.08, 0.6)
  la *= Math.max(1 - missing.away * 0.08, 0.6)

  // Kırmızı kart etkisi
  for (const ev of events) {
    if (ev.type === 'Card' && ev.detail === 'Red Card') {
      const isHome = ev.team.name === homeName
      if (isHome) { lh *= 0.75; la *= 1.15 }
      else         { la *= 0.75; lh *= 1.15 }
    }
  }

  // Canlı maçta kalan süreye göre normalize
  if (isLive) {
    const remaining = Math.max(90 - elapsed, 5) / 90
    lh *= remaining; la *= remaining
  }

  return {
    lh: Math.min(Math.max(lh, 0.1), 4.0),
    la: Math.min(Math.max(la, 0.1), 4.0),
  }
}

function poisson(lh: number, la: number) {
  const fac = (n: number): number => n <= 1 ? 1 : n * fac(n - 1)
  const p   = (l: number, k: number) => (l ** k * Math.exp(-l)) / fac(k)
  let home = 0, draw = 0, away = 0, ov = 0, bt = 0
  for (let gh = 0; gh <= 7; gh++) {
    for (let ga = 0; ga <= 7; ga++) {
      const pr = p(lh, gh) * p(la, ga)
      if (gh > ga) home += pr
      else if (gh === ga) draw += pr
      else away += pr
      if (gh + ga > 2.5) ov += pr
      if (gh > 0 && ga > 0) bt += pr
    }
  }
  return { home, draw, away, over25: ov, under25: 1-ov, btts: bt, bttsNo: 1-bt }
}

const toOdd = (p: number) => Math.round(1 / Math.max(p, 0.01) / 1.05 * 100) / 100
const rnd   = (n: number) => Math.round(n * 1000) / 1000

const NAME_MAP: Record<string, string> = {
  'United States': 'USA',
  'Bosnia And Herzegovina': 'Bosnia & Herzegovina',
}
function findMatch(matches: MatchPrediction[], h: string, a: string) {
  const hN = NAME_MAP[h] ?? h
  const aN = NAME_MAP[a] ?? a
  return matches.find(m =>
    (m.home.name === hN || m.home.name === h) &&
    (m.away.name === aN || m.away.name === a)
  )
}

export async function GET() {
  const log: string[] = []
  const t0 = Date.now()

  try {
    // Bugün maç var mı?
    const todayFixtures = await getTodayFixtures()
    if (todayFixtures.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Bugün maç yok' })
    }
    log.push(`✓ Bugün ${todayFixtures.length} maç`)

    const matches = await getMatches()
    let updated = 0

    for (const fixture of todayFixtures) {
      const homeName  = fixture.teams?.home?.name
      const awayName  = fixture.teams?.away?.name
      const status    = fixture.fixture?.status?.short
      const elapsed   = fixture.fixture?.status?.elapsed ?? 0
      const fixtureId = fixture.fixture?.id
      if (!homeName || !awayName) continue
      if (status === 'FT' || status === 'AET' || status === 'PEN') continue

      const match = findMatch(matches, homeName, awayName)
      if (!match) continue

      const isLive   = ['1H','HT','2H','ET','BT','P'].includes(status)
      const events   = isLive ? await getFixtureEvents(fixtureId) : []
      const missing  = !isLive ? await getMissingPlayers(fixtureId) : { home: 0, away: 0 }

      const { lh, la } = calcLambdas(
        match.home.elo ?? 1500, match.away.elo ?? 1500,
        events, homeName, elapsed, missing, isLive
      )

      const pr = poisson(lh, la)
      const ht = poisson(lh * 0.44, la * 0.44)

      match.ms = {
        home: { label:'MS 1', value: toOdd(pr.home), probability: rnd(pr.home) },
        draw: { label:'MS X', value: toOdd(pr.draw), probability: rnd(pr.draw) },
        away: { label:'MS 2', value: toOdd(pr.away), probability: rnd(pr.away) },
      }
      match.overUnder = { ...match.overUnder,
        expectedGoals: Math.round((lh+la)*10)/10,
        over:  { label:'2.5 Üst', value: toOdd(pr.over25),  probability: rnd(pr.over25)  },
        under: { label:'2.5 Alt', value: toOdd(pr.under25), probability: rnd(pr.under25) },
      }
      match.btts = {
        yes: { label:'KG Var', value: toOdd(pr.btts),   probability: rnd(pr.btts)   },
        no:  { label:'KG Yok', value: toOdd(pr.bttsNo), probability: rnd(pr.bttsNo) },
      }
      match.htMs = {
        home: { label:'İY 1', value: toOdd(ht.home), probability: rnd(ht.home) },
        draw: { label:'İY X', value: toOdd(ht.draw), probability: rnd(ht.draw) },
        away: { label:'İY 2', value: toOdd(ht.away), probability: rnd(ht.away) },
      }

      const redCards = events.filter((e: ApiEvent) => e.type === 'Card' && e.detail === 'Red Card')
      log.push(`  ${homeName} vs ${awayName} [${status} ${elapsed}'] — kırmızı:${redCards.length} eksik:${missing.home+missing.away}`)
      updated++
    }

    if (updated > 0) {
      await setMatches(matches)
      await setLastUpdate(new Date().toISOString())
      revalidatePath('/')
    }

    log.push(`✅ ${updated} maç güncellendi (${Date.now()-t0}ms)`)
    return NextResponse.json({ success: true, log })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
