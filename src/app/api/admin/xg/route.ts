import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getMatches, setMatches, setLastUpdate } from '@/lib/blob'

const SECRET = process.env.CRON_SECRET ?? 'wc26admin'

function isAuth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${SECRET}`
}

function poisson(lh: number, la: number) {
  const fac = (n: number): number => n <= 1 ? 1 : n * fac(n - 1)
  const p = (l: number, k: number) => (l ** k * Math.exp(-l)) / fac(k)
  let home = 0, draw = 0, away = 0, ov = 0, bt = 0
  for (let gh = 0; gh <= 7; gh++) for (let ga = 0; ga <= 7; ga++) {
    const pr = p(lh, gh) * p(la, ga)
    if (gh > ga) home += pr; else if (gh === ga) draw += pr; else away += pr
    if (gh + ga > 2.5) ov += pr; if (gh > 0 && ga > 0) bt += pr
  }
  return { home, draw, away, over25: ov, under25: 1 - ov, btts: bt, bttsNo: 1 - bt }
}
const toOdd = (p: number) => Math.round(1 / Math.max(p, 0.01) / 1.05 * 100) / 100
const rnd = (n: number) => Math.round(n * 1000) / 1000

function getXgFactor(teamName: string, isHome: boolean, allMatches: ReturnType<typeof Array.prototype.filter>): number {
  const recentPlayed = allMatches
    .filter((m: { result?: unknown; home: { name: string }; away: { name: string } }) =>
      m.result && (m.home.name === teamName || m.away.name === teamName)
    )
    .slice(-3)

  let totalXg = 0, count = 0
  for (const m of recentPlayed) {
    const result = m.result as { xgHome?: number; xgAway?: number }
    const isHomeTeam = m.home.name === teamName
    const xg = isHomeTeam ? result.xgHome : result.xgAway
    if (xg !== undefined) { totalXg += xg; count++ }
  }
  if (count === 0) return 1.0
  const avgXg = totalXg / count
  const leagueAvg = isHome ? 1.4 : 1.1
  return 1 + Math.min(Math.max((avgXg - leagueAvg) / leagueAvg, -0.15), 0.15)
}

export async function POST(req: NextRequest) {
  if (!isAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchId, xgHome, xgAway } = await req.json()
  if (!matchId || xgHome === undefined || xgAway === undefined) {
    return NextResponse.json({ error: 'matchId, xgHome, xgAway gerekli' }, { status: 400 })
  }

  const matches = await getMatches()
  const match = matches.find(m => m.id === matchId)
  if (!match) return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })
  if (!match.result) return NextResponse.json({ error: 'Maç henüz bitmemiş' }, { status: 400 })

  // xG'yi result'a ekle
  ;(match.result as Record<string, unknown>).xgHome = xgHome
  ;(match.result as Record<string, unknown>).xgAway = xgAway

  // Bu takımların sonraki maçlarını güncelle
  const updatedMatches: string[] = []
  const homeTeamName = match.home.name
  const awayTeamName = match.away.name

  for (const m of matches) {
    if (m.result) continue
    const affectsHome = m.home.name === homeTeamName || m.home.name === awayTeamName
    const affectsAway = m.away.name === homeTeamName || m.away.name === awayTeamName
    if (!affectsHome && !affectsAway) continue

    const eH = m.home.elo ?? 1500
    const eA = m.away.elo ?? 1500
    const diff = eH - eA
    const fac = 10 ** (diff / 400)

    const xgFactorH = getXgFactor(m.home.name, true,  matches)
    const xgFactorA = getXgFactor(m.away.name, false, matches)

    let lh = Math.min(Math.max(1.3 * fac ** 0.5 * xgFactorH, 0.4), 4.0)
    let la = Math.min(Math.max(1.3 / fac ** 0.5 * xgFactorA, 0.4), 4.0)

    const events = (m as { events?: Array<{ type: string; team: string }> }).events ?? []
    for (const ev of events) {
      if (ev.type === 'red_card') {
        if (ev.team === 'home') { lh *= 0.75; la *= 1.15 }
        else { la *= 0.75; lh *= 1.15 }
      } else if (ev.type === 'injury') {
        if (ev.team === 'home') lh *= 0.92
        else la *= 0.92
      }
    }
    lh = Math.min(Math.max(lh, 0.2), 4.0)
    la = Math.min(Math.max(la, 0.2), 4.0)

    const pr = poisson(lh, la)
    const ht = poisson(lh * 0.44, la * 0.44)

    m.ms = {
      home: { label: 'MS 1', value: toOdd(pr.home), probability: rnd(pr.home) },
      draw: { label: 'MS X', value: toOdd(pr.draw), probability: rnd(pr.draw) },
      away: { label: 'MS 2', value: toOdd(pr.away), probability: rnd(pr.away) },
    }
    m.overUnder = {
      ...m.overUnder,
      expectedGoals: Math.round((lh + la) * 10) / 10,
      over:  { label: '2.5 Üst', value: toOdd(pr.over25),  probability: rnd(pr.over25)  },
      under: { label: '2.5 Alt', value: toOdd(pr.under25), probability: rnd(pr.under25) },
    }
    m.btts = {
      yes: { label: 'KG Var', value: toOdd(pr.btts),   probability: rnd(pr.btts)   },
      no:  { label: 'KG Yok', value: toOdd(pr.bttsNo), probability: rnd(pr.bttsNo) },
    }
    m.htMs = {
      home: { label: 'İY 1', value: toOdd(ht.home), probability: rnd(ht.home) },
      draw: { label: 'İY X', value: toOdd(ht.draw), probability: rnd(ht.draw) },
      away: { label: 'İY 2', value: toOdd(ht.away), probability: rnd(ht.away) },
    }

    updatedMatches.push(`${m.home.name} vs ${m.away.name}`)
  }

  await setMatches(matches)
  await setLastUpdate(new Date().toISOString())
  revalidatePath('/')

  return NextResponse.json({
    success: true,
    message: `${homeTeamName} xG:${xgHome} · ${awayTeamName} xG:${xgAway} → ${updatedMatches.length} sonraki maç güncellendi`,
    updatedMatches,
  })
}
