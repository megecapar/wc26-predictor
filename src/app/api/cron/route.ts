/**
 * Vercel Cron Job — Her gece 02:00 UTC'de çalışır
 * vercel.json'da tanımlı
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import fs from 'fs'
import path from 'path'

const MATCHES_PATH     = path.join(process.cwd(), 'src', 'data', 'matches_real.json')
const CACHE_PATH       = path.join(process.cwd(), 'data_raw', 'live_cache.json')
const ODDS_API_KEY     = process.env.ODDS_API_KEY ?? ''
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY ?? ''
const CRON_SECRET      = process.env.CRON_SECRET ?? ''

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${CRON_SECRET}`
}

async function fetchRealOdds(): Promise<Record<string, {home:number, draw:number, away:number}>> {
  if (!ODDS_API_KEY) return {}
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?` +
      `apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&bookmakers=pinnacle,bet365`,
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`Odds API: ${res.status}`)
    const data = await res.json()
    const map: Record<string, {home:number, draw:number, away:number}> = {}
    for (const event of data) {
      const key = `${event.home_team}__${event.away_team}`
      const bm  = event.bookmakers.find((b: {key:string}) => b.key === 'pinnacle') ?? event.bookmakers[0]
      if (!bm) continue
      const h2h = bm.markets.find((m: {key:string}) => m.key === 'h2h')
      if (!h2h) continue
      const get = (name: string) => h2h.outcomes.find((o: {name:string}) => o.name === name)?.price ?? 0
      const ho = get(event.home_team), dr = get('Draw'), ao = get(event.away_team)
      if (ho && dr && ao) map[key] = { home: ho, draw: dr, away: ao }
    }
    console.log(`[cron] Odds API: ${Object.keys(map).length} maç`)
    return map
  } catch (e) { console.error('[cron] Odds API hatası:', e); return {} }
}

async function fetchFinished() {
  if (!API_FOOTBALL_KEY) return []
  try {
    const res = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026&status=FT',
      { headers: { 'x-rapidapi-key': API_FOOTBALL_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }, cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`API-Football: ${res.status}`)
    const data = await res.json()
    return (data.response ?? []).map((f: {teams:{home:{name:string},away:{name:string}},goals:{home:number,away:number}}) => ({
      home: f.teams.home.name, away: f.teams.away.name,
      homeScore: f.goals.home, awayScore: f.goals.away,
    }))
  } catch (e) { console.error('[cron] API-Football hatası:', e); return [] }
}

function updateElo(elo: Record<string,number>, home: string, away: string, hs: number, as_: number) {
  elo[home] ??= 1500; elo[away] ??= 1500
  const exp = 1 / (1 + 10 ** ((elo[away] - elo[home]) / 400))
  const s   = hs > as_ ? 1 : hs === as_ ? 0.5 : 0
  elo[home] += 60 * (s - exp); elo[away] += 60 * ((1 - s) - (1 - exp))
}

function poisson(lh: number, la: number) {
  const fac = (n: number): number => n <= 1 ? 1 : n * fac(n - 1)
  const p   = (l: number, k: number) => (l ** k * Math.exp(-l)) / fac(k)
  let home = 0, draw = 0, away = 0, ov = 0, bt = 0
  for (let gh = 0; gh <= 7; gh++) for (let ga = 0; ga <= 7; ga++) {
    const pr = p(lh, gh) * p(la, ga)
    if (gh > ga) home += pr; else if (gh === ga) draw += pr; else away += pr
    if (gh + ga > 2.5) ov += pr
    if (gh > 0 && ga > 0) bt += pr
  }
  return { home, draw, away, over25: ov, under25: 1-ov, btts: bt, bttsNo: 1-bt }
}

const odd = (p: number) => Math.round(1 / Math.max(p, 0.01) / 1.05 * 100) / 100
const rnd = (n: number) => Math.round(n * 1000) / 1000

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const log: string[] = []
  try {
    if (!fs.existsSync(MATCHES_PATH)) return NextResponse.json({ error: 'matches_real.json yok' }, { status: 500 })
    const matches = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf-8'))

    let cache: { finished: Array<{home:string,away:string,homeScore:number,awayScore:number}> } = { finished: [] }
    if (fs.existsSync(CACHE_PATH)) cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'))

    const finished = await fetchFinished()
    const cachedKeys = new Set(cache.finished.map(f => `${f.home}__${f.away}`))
    const newOnes = finished.filter(f => !cachedKeys.has(`${f.home}__${f.away}`))
    cache.finished.push(...newOnes)
    log.push(`${newOnes.length} yeni maç sonucu`)

    const elo: Record<string,number> = {}
    for (const f of cache.finished) updateElo(elo, f.home, f.away, f.homeScore, f.awayScore)

    const realOdds = await fetchRealOdds()
    log.push(`${Object.keys(realOdds).length} gerçek oran alındı`)

    const finishedKeys = new Set(cache.finished.map(f => `${f.home}__${f.away}`))
    let updated = 0

    for (const match of matches) {
      const hN = match.home.name, aN = match.away.name, key = `${hN}__${aN}`
      if (finishedKeys.has(key)) {
        const r = cache.finished.find(f => f.home === hN && f.away === aN)
        if (r) match.result = { homeScore: r.homeScore, awayScore: r.awayScore, status: 'FT' }
        continue
      }
      const eH = elo[hN] ?? match.home.elo ?? 1500
      const eA = elo[aN] ?? match.away.elo ?? 1500
      const diff = eH - eA, fac = 10 ** (diff / 400)
      const lh = Math.min(Math.max(1.3 * fac ** 0.5, 0.4), 4.0)
      const la = Math.min(Math.max(1.3 / fac ** 0.5, 0.4), 4.0)
      const pr = poisson(lh, la), ht = poisson(lh * 0.44, la * 0.44)
      const ro = realOdds[key]

      match.ms = {
        home: { label:'MS 1', value: ro?.home ?? odd(pr.home), probability: rnd(pr.home) },
        draw: { label:'MS X', value: ro?.draw ?? odd(pr.draw), probability: rnd(pr.draw) },
        away: { label:'MS 2', value: ro?.away ?? odd(pr.away), probability: rnd(pr.away) },
      }
      match.overUnder = { ...match.overUnder, expectedGoals: Math.round((lh+la)*10)/10,
        over:  { label:'2.5 Üst', value: odd(pr.over25),  probability: rnd(pr.over25)  },
        under: { label:'2.5 Alt', value: odd(pr.under25), probability: rnd(pr.under25) },
      }
      match.btts = {
        yes: { label:'KG Var', value: odd(pr.btts),   probability: rnd(pr.btts)   },
        no:  { label:'KG Yok', value: odd(pr.bttsNo), probability: rnd(pr.bttsNo) },
      }
      match.htMs = {
        home: { label:'İY 1', value: odd(ht.home), probability: rnd(ht.home) },
        draw: { label:'İY X', value: odd(ht.draw), probability: rnd(ht.draw) },
        away: { label:'İY 2', value: odd(ht.away), probability: rnd(ht.away) },
      }
      match.confidence = Math.abs(diff) > 150 ? 'high' : Math.abs(diff) > 60 ? 'mid' : 'low'
      match.home.elo = Math.round(eH); match.away.elo = Math.round(eA)
      updated++
    }

    log.push(`${updated} maç güncellendi`)
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
    fs.writeFileSync(MATCHES_PATH, JSON.stringify(matches, null, 2))
    revalidatePath('/')
    log.push('✅ Tamamlandı')

    return NextResponse.json({ success: true, log })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg, log }, { status: 500 })
  }
}
