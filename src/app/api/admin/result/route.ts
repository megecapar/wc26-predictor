import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getMatches, setMatches, getElo, setElo, setLastUpdate } from '@/lib/blob'

const SECRET = process.env.CRON_SECRET ?? 'wc26admin'

function isAuth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${SECRET}`
}

function updateElo(elo: Record<string,number>, home: string, away: string, hs: number, as_: number) {
  elo[home] ??= 1500; elo[away] ??= 1500
  const exp = 1 / (1 + 10 ** ((elo[away] - elo[home]) / 400))
  const s   = hs > as_ ? 1 : hs === as_ ? 0.5 : 0
  const K   = 60
  elo[home] += K * (s - exp)
  elo[away] += K * ((1 - s) - (1 - exp))
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

  // Kalan maçların tahminlerini ELO ile yeniden hesapla
  let updated = 0
  for (const m of matches) {
    if (m.result) continue
    const eH = elo[m.home.name] ?? m.home.elo ?? 1500
    const eA = elo[m.away.name] ?? m.away.elo ?? 1500
    const diff = eH - eA, fac = 10**(diff/400)
    const lh = Math.min(Math.max(1.3*fac**0.5, 0.4), 4.0)
    const la = Math.min(Math.max(1.3/fac**0.5, 0.4), 4.0)
    const pr = poisson(lh, la), ht = poisson(lh*0.44, la*0.44)

    // Olasılıkları güncelle (Nesine oranlarına dokunma)
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
    m.home.elo = Math.round(eH)
    m.away.elo = Math.round(eA)
    m.confidence = Math.abs(diff)>150?'high':Math.abs(diff)>60?'mid':'low'
    updated++
  }

  await Promise.all([
    setMatches(matches),
    setElo(elo),
    setLastUpdate(new Date().toISOString()),
  ])
  revalidatePath('/')
  revalidatePath('/bracket')
  revalidatePath('/standings')

  return NextResponse.json({
    success: true,
    message: `${match.home.name} ${homeScore}-${awayScore} ${match.away.name} kaydedildi. ${updated} maç güncellendi.`,
    eloChange: {
      [match.home.name]: Math.round(elo[match.home.name]),
      [match.away.name]: Math.round(elo[match.away.name]),
    }
  })
}
