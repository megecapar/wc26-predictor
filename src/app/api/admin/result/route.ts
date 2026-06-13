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

// Bir takımın son maçtaki xG performansından lambda faktörü hesapla
function getXgFactor(teamName: string, isHome: boolean, allMatches: ReturnType<typeof Array.prototype.filter>): number {
  const recentPlayed = allMatches
    .filter((m: { result?: unknown; home: { name: string }; away: { name: string } }) =>
      m.result && (m.home.name === teamName || m.away.name === teamName)
    )
    .slice(-3) // Son 3 maç

  if (recentPlayed.length === 0) return 1.0

  let totalXgFor = 0, count = 0
  for (const m of recentPlayed) {
    const result = m.result as { xgHome?: number; xgAway?: number; homeScore: number; awayScore: number }
    const isHomeTeam = m.home.name === teamName
    const xg = isHomeTeam ? result.xgHome : result.xgAway
    if (xg !== undefined) {
      totalXgFor += xg
      count++
    }
  }

  if (count === 0) return 1.0

  const avgXg = totalXgFor / count
  const leagueAvg = isHome ? 1.4 : 1.1 // WC ortalaması tahmini

  // xG performansı ligortalamasına göre %15'e kadar etkili
  const factor = 1 + Math.min(Math.max((avgXg - leagueAvg) / leagueAvg, -0.15), 0.15)
  return factor
}

export async function POST(req: NextRequest) {
  if (!isAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { matchId, homeScore, awayScore, xgHome, xgAway } = body

  if (!matchId || homeScore === undefined || awayScore === undefined) {
    return NextResponse.json({ error: 'matchId, homeScore, awayScore gerekli' }, { status: 400 })
  }

  const matches = await getMatches()
  const idx = matches.findIndex(m => m.id === matchId)
  if (idx === -1) return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })

  const match = matches[idx]

  // Sonucu kaydet (xG dahil)
  match.result = {
    homeScore,
    awayScore,
    status: 'FT',
    ...(xgHome !== undefined && { xgHome }),
    ...(xgAway !== undefined && { xgAway }),
  }

  // ELO güncelle
  const K = 30
  const eH = match.home.elo ?? 1500
  const eA = match.away.elo ?? 1500
  const expH = 1 / (1 + 10 ** ((eA - eH) / 400))
  const score = homeScore > awayScore ? 1 : homeScore === awayScore ? 0.5 : 0
  const newEloH = Math.round(eH + K * (score - expH))
  const newEloA = Math.round(eA + K * ((1 - score) - (1 - expH)))

  // ELO'yu bu maçta güncelle
  match.home.elo = newEloH
  match.away.elo = newEloA

  // Aynı takımların sonraki maçlarını bul ve oranlarını güncelle (xG faktörü ile)
  const updatedMatches: string[] = []

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (m.result) continue // Biten maçları atla
    if (m.id === matchId) continue

    const homeTeam = m.home.name
    const awayTeam = m.away.name

    // Bu maçta oynayan takımlar var mı?
    const homeJustPlayed = homeTeam === match.home.name || homeTeam === match.away.name
    const awayJustPlayed = awayTeam === match.home.name || awayTeam === match.away.name

    if (!homeJustPlayed && !awayJustPlayed) continue

    // Güncel ELO al
    const updatedEloH = homeJustPlayed
      ? (homeTeam === match.home.name ? newEloH : newEloA)
      : m.home.elo ?? 1500
    const updatedEloA = awayJustPlayed
      ? (awayTeam === match.home.name ? newEloH : newEloA)
      : m.away.elo ?? 1500

    // ELO'ları güncelle
    if (homeJustPlayed) m.home.elo = updatedEloH
    if (awayJustPlayed) m.away.elo = updatedEloA

    // xG faktörü
    const xgFactorH = getXgFactor(homeTeam, true, matches)
    const xgFactorA = getXgFactor(awayTeam, false, matches)

    // Lambda hesapla
    const diff = updatedEloH - updatedEloA
    const fac = 10 ** (diff / 400)
    let lh = Math.min(Math.max(1.3 * fac ** 0.5 * xgFactorH, 0.4), 4.0)
    let la = Math.min(Math.max(1.3 / fac ** 0.5 * xgFactorA, 0.4), 4.0)

    // Events varsa uygula
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

  // Kuponları değerlendir
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(supabaseUrl, serviceKey)

      const { data: bets } = await sb
        .from('coupon_bets')
        .select('*, coupons(user_id)')
        .eq('match_id', matchId)

      if (bets && bets.length > 0) {
        for (const bet of bets) {
          let won: boolean | null = null
          if (bet.market_key === 'ms_home') won = homeScore > awayScore
          else if (bet.market_key === 'ms_draw') won = homeScore === awayScore
          else if (bet.market_key === 'ms_away') won = awayScore > homeScore
          else if (bet.market_key === 'over25') won = homeScore + awayScore > 2.5
          else if (bet.market_key === 'under25') won = homeScore + awayScore <= 2.5
          else if (bet.market_key === 'btts_yes') won = homeScore > 0 && awayScore > 0
          else if (bet.market_key === 'btts_no') won = !(homeScore > 0 && awayScore > 0)

          if (won !== null) {
            await sb.from('coupon_bets').update({ result: won ? 'win' : 'loss' }).eq('id', bet.id)
          }
        }
      }
    }
  } catch (e) {
    console.error('Kupon güncelleme hatası:', e)
  }

  await setMatches(matches)
  await setLastUpdate(new Date().toISOString())
  revalidatePath('/')
  revalidatePath('/bracket')
  revalidatePath('/standings')

  const xgMsg = (xgHome !== undefined && xgAway !== undefined)
    ? ` · xG: ${xgHome}-${xgAway} (${updatedMatches.length} sonraki maç güncellendi)`
    : ` · ${updatedMatches.length} sonraki maç ELO güncellendi`

  return NextResponse.json({
    success: true,
    message: `${match.home.name} ${homeScore}-${awayScore} ${match.away.name}${xgMsg}`,
    updatedMatches,
  })
}
