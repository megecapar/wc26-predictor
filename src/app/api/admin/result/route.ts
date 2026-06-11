import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getMatches, setMatches, getElo, setElo, setLastUpdate } from '@/lib/blob'
import { createClient } from '@supabase/supabase-js'

const SECRET = process.env.CRON_SECRET ?? ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

function isAuth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${SECRET}`
}

function updateElo(elo: Record<string,number>, home: string, away: string, hs: number, as_: number) {
  elo[home] ??= 1500; elo[away] ??= 1500
  const exp = 1 / (1 + 10 ** ((elo[away] - elo[home]) / 400))
  const s   = hs > as_ ? 1 : hs === as_ ? 0.5 : 0
  elo[home] += 60 * (s - exp); elo[away] += 60 * ((1 - s) - (1 - exp))
}

function poisson(lh: number, la: number) {
  const fac = (n: number): number => n <= 1 ? 1 : n * fac(n-1)
  const p   = (l: number, k: number) => (l**k * Math.exp(-l)) / fac(k)
  let home=0, draw=0, away=0, ov=0, bt=0
  for (let gh=0; gh<=7; gh++) for (let ga=0; ga<=7; ga++) {
    const pr = p(lh,gh)*p(la,ga)
    if (gh>ga) home+=pr; else if (gh===ga) draw+=pr; else away+=pr
    if (gh+ga>2.5) ov+=pr; if (gh>0&&ga>0) bt+=pr
  }
  return { home, draw, away, over25:ov, under25:1-ov, btts:bt, bttsNo:1-bt }
}
const toOdd = (p: number) => Math.round(1/Math.max(p,0.01)/1.05*100)/100
const rnd   = (n: number) => Math.round(n*1000)/1000

// Bahis sonucunu belirle
function checkBet(marketKey: string, homeScore: number, awayScore: number): 'won' | 'lost' {
  const total = homeScore + awayScore
  if (marketKey === 'ms.home') return homeScore > awayScore ? 'won' : 'lost'
  if (marketKey === 'ms.draw') return homeScore === awayScore ? 'won' : 'lost'
  if (marketKey === 'ms.away') return awayScore > homeScore ? 'won' : 'lost'
  if (marketKey === 'ou.over')  return total > 2.5 ? 'won' : 'lost'
  if (marketKey === 'ou.under') return total <= 2.5 ? 'won' : 'lost'
  if (marketKey === 'btts.yes') return homeScore > 0 && awayScore > 0 ? 'won' : 'lost'
  if (marketKey === 'btts.no')  return !(homeScore > 0 && awayScore > 0) ? 'won' : 'lost'
  if (marketKey === 'ht.home') return homeScore > awayScore ? 'won' : 'lost'
  if (marketKey === 'ht.draw') return homeScore === awayScore ? 'won' : 'lost'
  if (marketKey === 'ht.away') return awayScore > homeScore ? 'won' : 'lost'
  return 'lost'
}

export async function POST(req: NextRequest) {
  if (!isAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchId, homeScore, awayScore } = await req.json()
  if (!matchId || homeScore === undefined || awayScore === undefined) {
    return NextResponse.json({ error: 'matchId, homeScore, awayScore gerekli' }, { status: 400 })
  }

  const [matches, elo] = await Promise.all([getMatches(), getElo()])
  const match = matches.find(m => m.id === matchId)
  if (!match) return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })

  // Sonucu kaydet
  match.result = { homeScore, awayScore, status: 'FT' }

  // ELO güncelle
  updateElo(elo, match.home.name, match.away.name, homeScore, awayScore)

  // Kalan maçları yeniden hesapla
  let updated = 0
  for (const m of matches) {
    if (m.result) continue
    const eH = elo[m.home.name] ?? m.home.elo ?? 1500
    const eA = elo[m.away.name] ?? m.away.elo ?? 1500
    const diff = eH - eA, fac = 10**(diff/400)
    const lh = Math.min(Math.max(1.3*fac**0.5, 0.4), 4.0)
    const la = Math.min(Math.max(1.3/fac**0.5, 0.4), 4.0)
    const pr = poisson(lh, la), ht = poisson(lh*0.44, la*0.44)
    m.ms.home.probability = rnd(pr.home)
    m.ms.draw.probability = rnd(pr.draw)
    m.ms.away.probability = rnd(pr.away)
    m.overUnder.expectedGoals = Math.round((lh+la)*10)/10
    m.overUnder.over.probability  = rnd(pr.over25)
    m.overUnder.under.probability = rnd(pr.under25)
    m.btts.yes.probability = rnd(pr.btts)
    m.btts.no.probability  = rnd(pr.bttsNo)
    m.htMs.home.probability = rnd(ht.home)
    m.htMs.draw.probability = rnd(ht.draw)
    m.htMs.away.probability = rnd(ht.away)
    m.home.elo = Math.round(eH); m.away.elo = Math.round(eA)
    m.confidence = Math.abs(diff)>150?'high':Math.abs(diff)>60?'mid':'low'
    updated++
  }

  // Kuponları güncelle (Supabase)
  let couponsUpdated = 0
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Bu maça ait tüm bahisleri bul
    const { data: bets } = await supabase
      .from('coupon_bets')
      .select('id, coupon_id, market_key, odd')
      .eq('match_id', matchId)

    if (bets && bets.length > 0) {
      for (const bet of bets) {
        const result = checkBet(bet.market_key, homeScore, awayScore)
        await supabase.from('coupon_bets').update({ result }).eq('id', bet.id)
      }

      // Kupon durumlarını güncelle
      const couponIds = [...new Set(bets.map(b => b.coupon_id))]
      for (const couponId of couponIds) {
        const { data: allBets } = await supabase
          .from('coupon_bets').select('result, odd').eq('coupon_id', couponId)

        if (!allBets) continue
        const pending = allBets.some(b => b.result === 'pending')
        const lost    = allBets.some(b => b.result === 'lost')

        if (!pending) {
          const status = lost ? 'lost' : 'won'
          const pointsWon = status === 'won' ? 50 : 0

          await supabase.from('coupons').update({ status, points_won: pointsWon }).eq('id', couponId)

          // Kazandıysa puan ver
          if (status === 'won') {
            const { data: coupon } = await supabase.from('coupons').select('user_id').eq('id', couponId).single()
            if (coupon) {
              await supabase.rpc('increment_points', { user_id: coupon.user_id, amount: pointsWon })
            }
          }
          couponsUpdated++
        }
      }
    }
  } catch (e) {
    console.error('Kupon güncelleme hatası:', e)
  }

  await Promise.all([setMatches(matches), setElo(elo), setLastUpdate(new Date().toISOString())])
  revalidatePath('/'); revalidatePath('/bracket'); revalidatePath('/standings')

  return NextResponse.json({
    success: true,
    message: `${match.home.name} ${homeScore}-${awayScore} ${match.away.name} kaydedildi`,
    matchesUpdated: updated,
    couponsUpdated,
    eloChange: { [match.home.name]: Math.round(elo[match.home.name]), [match.away.name]: Math.round(elo[match.away.name]) }
  })
}
