import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  getMatches, setMatches,
  getElo, setElo,
  getFinishedMatches, setFinishedMatches,
  setLastUpdate, FinishedMatch
} from '@/lib/blob'

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY ?? ''
const NOSY_API_KEY     = process.env.NOSY_API_KEY ?? ''
const CRON_SECRET      = process.env.CRON_SECRET ?? ''

function isAuthorized(req: NextRequest) {
  if (req.headers.get('x-vercel-cron') === '1') return true
  return req.headers.get('authorization') === `Bearer ${CRON_SECRET}`
}

async function fetchFinished(): Promise<FinishedMatch[]> {
  if (!API_FOOTBALL_KEY) return []
  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026&status=FT',
      {
        headers: {
          'x-rapidapi-key': API_FOOTBALL_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) throw new Error(`API-Football ${res.status}`)
    const data = await res.json()
    return (data.response ?? []).map((f: {
      teams: { home: { name: string }, away: { name: string } }
      goals: { home: number, away: number }
      fixture: { date: string }
    }) => ({
      home: f.teams.home.name,
      away: f.teams.away.name,
      homeScore: f.goals.home ?? 0,
      awayScore: f.goals.away ?? 0,
      date: f.fixture.date.slice(0, 10),
    }))
  } catch (e) { console.error('[cron] API-Football:', e); return [] }
}

async function fetchNosyOdds(): Promise<Record<string, { ms1: number, msX: number, ms2: number }>> {
  if (!NOSY_API_KEY) return {}
  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(
      `https://www.nosyapi.com/apiv2/service/bettable-matches?apiKey=${NOSY_API_KEY}&date=${today}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return {}
    const data = await res.json()
    if (data.status !== 'success') return {}

    const map: Record<string, { ms1: number, msX: number, ms2: number }> = {}

    for (const match of data.data ?? []) {
      const detRes = await fetch(
        `https://www.nosyapi.com/apiv2/service/bettable-matches/details?apiKey=${NOSY_API_KEY}&matchId=${match.id}`,
        { cache: 'no-store' }
      )
      if (!detRes.ok) continue
      const det = await detRes.json()
      if (det.status !== 'success') continue

      const ms = det.data?.odds?.find((o: { name: string }) =>
        o.name === 'Maç Sonucu' || o.name === 'MS'
      )
      if (!ms) continue

      const get = (label: string) =>
        parseFloat(ms.outcomes?.find((o: { label: string }) => o.label === label)?.odd ?? '0')

      const ms1 = get('1'), msX = get('X'), ms2 = get('2')
      if (ms1 && msX && ms2) {
        map[`${match.homeTeam}__${match.awayTeam}`] = { ms1, msX, ms2 }
      }
    }
    return map
  } catch (e) { console.error('[cron] Nosy:', e); return {} }
}

function updateElo(elo: Record<string, number>, home: string, away: string, hs: number, as_: number) {
  elo[home] ??= 1500; elo[away] ??= 1500
  const exp = 1 / (1 + 10 ** ((elo[away] - elo[home]) / 400))
  const s   = hs > as_ ? 1 : hs === as_ ? 0.5 : 0
  elo[home] += 60 * (s - exp)
  elo[away] += 60 * ((1 - s) - (1 - exp))
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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const log: string[] = []
  const t0 = Date.now()

  try {
    const [matches, storedElo, storedFinished] = await Promise.all([
      getMatches(), getElo(), getFinishedMatches()
    ])
    log.push(`✓ ${matches.length} maç yüklendi`)

    const apiFinished  = await fetchFinished()
    const cachedKeys   = new Set(storedFinished.map(f => `${f.home}__${f.away}`))
    const newFinished  = apiFinished.filter(f => !cachedKeys.has(`${f.home}__${f.away}`))
    const allFinished  = [...storedFinished, ...newFinished]
    log.push(`✓ ${newFinished.length} yeni maç sonucu`)

    const elo = { ...storedElo }
    for (const f of newFinished) updateElo(elo, f.home, f.away, f.homeScore, f.awayScore)

    const nosyOdds = await fetchNosyOdds()
    log.push(`✓ ${Object.keys(nosyOdds).length} gerçek oran`)

    const finishedKeys = new Set(allFinished.map(f => `${f.home}__${f.away}`))
    let updated = 0

    for (const match of matches) {
      const hN = match.home.name, aN = match.away.name, key = `${hN}__${aN}`

      if (finishedKeys.has(key)) {
        const r = allFinished.find(f => f.home === hN && f.away === aN)
        if (r) match.result = { homeScore: r.homeScore, awayScore: r.awayScore, status: 'FT' }
        continue
      }

      const eH = elo[hN] ?? match.home.elo ?? 1500
      const eA = elo[aN] ?? match.away.elo ?? 1500
      const diff = eH - eA, fac = 10 ** (diff / 400)
      const lh = Math.min(Math.max(1.3 * fac ** 0.5, 0.4), 4.0)
      const la = Math.min(Math.max(1.3 / fac ** 0.5, 0.4), 4.0)
      const pr = poisson(lh, la), ht = poisson(lh * 0.44, la * 0.44)
      const no = nosyOdds[key]

      match.ms = {
        home: { label:'MS 1', value: no?.ms1 ?? toOdd(pr.home), probability: rnd(pr.home) },
        draw: { label:'MS X', value: no?.msX ?? toOdd(pr.draw), probability: rnd(pr.draw) },
        away: { label:'MS 2', value: no?.ms2 ?? toOdd(pr.away), probability: rnd(pr.away) },
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
      match.confidence = Math.abs(diff) > 150 ? 'high' : Math.abs(diff) > 60 ? 'mid' : 'low'
      match.home.elo = Math.round(eH)
      match.away.elo = Math.round(eA)
      updated++
    }
    log.push(`✓ ${updated} maç güncellendi`)

    await Promise.all([
      setMatches(matches), setElo(elo),
      setFinishedMatches(allFinished),
      setLastUpdate(new Date().toISOString()),
    ])
    revalidatePath('/')
    log.push(`✅ Tamamlandı (${Date.now()-t0}ms)`)
    return NextResponse.json({ success: true, log })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push(`❌ Hata: ${msg}`)
    return NextResponse.json({ success: false, log, error: msg }, { status: 500 })
  }
}
