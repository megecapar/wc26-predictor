/**
 * GET /api/live
 * Canlı maç takibi — sadece maç olan günlerde çalışır
 * Vercel Cron: her 5 dakikada bir (maç günleri)
 * 
 * vercel.json'a ekle:
 * { "path": "/api/live", "schedule": "*/5 * * * *" }
 * 
 * Ne yapar:
 * 1. Bugün maç var mı kontrol et
 * 2. Canlı maçlardaki eventleri çek (kırmızı kart, gol, sakatlık)
 * 3. Etkilenen maçların lambdalarını güncelle
 * 4. Yeni oranları hesapla → Blob'a yaz → site güncellenir
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getMatches, setMatches, setLastUpdate } from '@/lib/blob'
import { MatchPrediction } from '@/lib/types'

const API_KEY     = process.env.API_FOOTBALL_KEY ?? ''
const CRON_SECRET = process.env.CRON_SECRET ?? ''

function isAuthorized(req: NextRequest) {
  if (req.headers.get('x-vercel-cron') === '1') return true
  return req.headers.get('authorization') === `Bearer ${CRON_SECRET}`
}

// ── API-Football helpers ──────────────────────────────────────────────────────
async function apiFetch(endpoint: string) {
  const res = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${endpoint}`)
  return res.json()
}

// ── Bugün WC maçı var mı? ─────────────────────────────────────────────────────
async function getTodayFixtures() {
  const today = new Date().toISOString().slice(0, 10)
  const data  = await apiFetch(`fixtures?league=1&season=2026&date=${today}`)
  return data.response ?? []
}

// ── Canlı maç eventleri ───────────────────────────────────────────────────────
interface ApiEvent {
  type: string      // 'Card', 'Goal', 'subst'
  detail: string    // 'Red Card', 'Yellow Card', 'Normal Goal'
  team: { name: string }
  player: { name: string }
  time: { elapsed: number }
}

async function getFixtureEvents(fixtureId: number): Promise<ApiEvent[]> {
  const data = await apiFetch(`fixtures/events?fixture=${fixtureId}`)
  return data.response ?? []
}

// ── Eksik oyuncu etkisi (maç öncesi) ─────────────────────────────────────────
interface ApiPlayer {
  player: { name: string }
  statistics: Array<{ games: { minutes: number } }>
}

async function getMissingPlayers(fixtureId: number): Promise<{ home: number, away: number }> {
  try {
    const data = await apiFetch(`injuries?fixture=${fixtureId}`)
    const injuries = data.response ?? []
    // Kaç önemli oyuncu eksik (90+ dakika oynayan)
    let home = 0, away = 0
    for (const inj of injuries) {
      const mins = inj.player?.statistics?.[0]?.games?.minutes ?? 0
      if (mins > 500) { // Önemli oyuncu eşiği
        if (inj.team?.id === injuries[0]?.teams?.home?.id) home++
        else away++
      }
    }
    return { home, away }
  } catch { return { home: 0, away: 0 } }
}

// ── Lambda ayarlamaları ───────────────────────────────────────────────────────
function adjustLambdaForEvents(
  baseLh: number,
  baseLa: number,
  events: ApiEvent[],
  homeName: string,
  elapsed: number
) {
  let lh = baseLh, la = baseLa

  for (const ev of events) {
    const isHome = ev.team.name === homeName

    if (ev.type === 'Card' && ev.detail === 'Red Card') {
      // Kırmızı kart: o takımın saldırı gücü -25%, rakibin +15%
      if (isHome) { lh *= 0.75; la *= 1.15 }
      else         { la *= 0.75; lh *= 1.15 }
    }
  }

  // İkinci yarı için kalan süreye göre normalize et
  // Maç bitmemişse kalan dakikaları hesaba kat
  const remaining = Math.max(90 - elapsed, 5) / 90
  lh = lh * remaining
  la = la * remaining

  return { lh: Math.min(Math.max(lh, 0.1), 4.0), la: Math.min(Math.max(la, 0.1), 4.0) }
}

function adjustLambdaForMissing(lh: number, la: number, missing: { home: number, away: number }) {
  // Her eksik önemli oyuncu için %8 düşüş
  const homeAdj = Math.max(1 - missing.home * 0.08, 0.6)
  const awayAdj = Math.max(1 - missing.away * 0.08, 0.6)
  return { lh: lh * homeAdj, la: la * awayAdj }
}

// ── Poisson ───────────────────────────────────────────────────────────────────
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

// ── Maç ismi eşleştirme ───────────────────────────────────────────────────────
// API-Football takım isimleri ile bizim isimlerimiz farklı olabilir
const NAME_MAP: Record<string, string> = {
  'United States': 'USA',
  'Bosnia And Herzegovina': 'Bosnia & Herzegovina',
  'Ivory Coast': "Ivory Coast",
  'DR Congo': 'DR Congo',
}
function normName(name: string) {
  return NAME_MAP[name] ?? name
}

function findMatch(matches: MatchPrediction[], homeName: string, awayName: string) {
  const h = normName(homeName)
  const a = normName(awayName)
  return matches.find(m =>
    (m.home.name === h && m.away.name === a) ||
    (m.home.name === homeName && m.away.name === awayName)
  )
}

// ── Ana handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const log: string[] = []
  const t0 = Date.now()

  try {
    // 1. Bugün maç var mı?
    log.push('Bugünkü maçlar kontrol ediliyor...')
    const todayFixtures = await getTodayFixtures()

    if (todayFixtures.length === 0) {
      log.push('Bugün WC maçı yok — işlem atlandı')
      return NextResponse.json({ success: true, log, skipped: true })
    }
    log.push(`✓ Bugün ${todayFixtures.length} maç var`)

    // 2. Mevcut maçları yükle
    const matches = await getMatches()
    let updated = 0

    // 3. Her fikstür için event ve eksik oyuncuları çek
    for (const fixture of todayFixtures) {
      const homeName = fixture.teams?.home?.name
      const awayName = fixture.teams?.away?.name
      const status   = fixture.fixture?.status?.short // NS, 1H, HT, 2H, FT
      const elapsed  = fixture.fixture?.status?.elapsed ?? 0
      const fixtureId = fixture.fixture?.id

      if (!homeName || !awayName) continue

      // Biten maç — atla
      if (status === 'FT' || status === 'AET' || status === 'PEN') {
        log.push(`  ${homeName} vs ${awayName}: Bitti`)
        continue
      }

      const match = findMatch(matches, homeName, awayName)
      if (!match) {
        log.push(`  ${homeName} vs ${awayName}: Listede bulunamadı`)
        continue
      }

      // ELO'dan base lambda hesapla
      const eH   = match.home.elo ?? 1500
      const eA   = match.away.elo ?? 1500
      const diff = eH - eA
      const fac  = 10 ** (diff / 400)
      let lh = Math.min(Math.max(1.3 * fac ** 0.5, 0.4), 4.0)
      let la = Math.min(Math.max(1.3 / fac ** 0.5, 0.4), 4.0)

      if (status === 'NS') {
        // Maç öncesi: eksik oyuncuları kontrol et
        const missing = await getMissingPlayers(fixtureId)
        if (missing.home > 0 || missing.away > 0) {
          const adj = adjustLambdaForMissing(lh, la, missing)
          lh = adj.lh; la = adj.la
          log.push(`  ${homeName} vs ${awayName}: Eksik oyuncu — ev:${missing.home} dep:${missing.away}`)
        }
      } else {
        // Maç sırası: canlı eventleri çek
        const events = await getFixtureEvents(fixtureId)
        const redCards = events.filter(e => e.type === 'Card' && e.detail === 'Red Card')

        if (redCards.length > 0) {
          log.push(`  ${homeName} vs ${awayName}: ${redCards.length} kırmızı kart — ${elapsed}'`)
        }

        const adj = adjustLambdaForEvents(lh, la, events, homeName, elapsed)
        lh = adj.lh; la = adj.la
      }

      // Yeni oranları hesapla
      const pr = poisson(lh, la)
      const ht = poisson(lh * 0.44, la * 0.44)

      match.ms = {
        home: { label:'MS 1', value: toOdd(pr.home), probability: rnd(pr.home) },
        draw: { label:'MS X', value: toOdd(pr.draw), probability: rnd(pr.draw) },
        away: { label:'MS 2', value: toOdd(pr.away), probability: rnd(pr.away) },
      }
      match.overUnder = {
        ...match.overUnder,
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
      match.confidence = Math.abs(diff) > 150 ? 'high' : Math.abs(diff) > 60 ? 'mid' : 'low'
      updated++
    }

    // 4. Blob'a yaz
    if (updated > 0) {
      await setMatches(matches)
      await setLastUpdate(new Date().toISOString())
      revalidatePath('/')
      log.push(`✓ ${updated} maç güncellendi`)
    } else {
      log.push('Güncellenecek maç yok')
    }

    log.push(`✅ Tamamlandı (${Date.now()-t0}ms)`)
    return NextResponse.json({ success: true, log })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push(`❌ Hata: ${msg}`)
    return NextResponse.json({ success: false, log, error: msg }, { status: 500 })
  }
}
