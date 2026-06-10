import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getMatches, setMatches, setLastUpdate } from '@/lib/blob'

const SECRET = process.env.CRON_SECRET ?? 'wc26admin'

function isAuth(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${SECRET}`
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

  const { matchId, type, team, player, minute } = await req.json()
  if (!matchId || !type || !team) {
    return NextResponse.json({ error: 'matchId, type, team gerekli' }, { status: 400 })
  }

  const matches = await getMatches()
  const match = matches.find(m => m.id === matchId)
  if (!match) return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })
  if (match.result) return NextResponse.json({ error: 'Maç zaten bitti' }, { status: 400 })

  // Mevcut ELO'dan lambda hesapla
  const eH = match.home.elo ?? 1500
  const eA = match.away.elo ?? 1500
  const diff = eH - eA, fac = 10**(diff/400)
  let lh = Math.min(Math.max(1.3*fac**0.5, 0.4), 4.0)
  let la = Math.min(Math.max(1.3/fac**0.5, 0.4), 4.0)

  // Events uygula
  const events: Array<{type:string, team:string, player?:string, minute?:number}> =
    (match as {events?: Array<{type:string, team:string, player?:string, minute?:number}>}).events ?? []
  events.push({ type, team, player, minute })
  ;(match as {events?: unknown}).events = events

  // Tüm eventleri lambda'ya uygula
  for (const ev of events) {
    if (ev.type === 'red_card') {
      if (ev.team === 'home') { lh *= 0.75; la *= 1.15 }
      else                    { la *= 0.75; lh *= 1.15 }
    } else if (ev.type === 'injury') {
      // Önemli oyuncu sakatlığı: %8 düşüş
      if (ev.team === 'home') lh *= 0.92
      else                    la *= 0.92
    }
  }
  lh = Math.min(Math.max(lh, 0.2), 4.0)
  la = Math.min(Math.max(la, 0.2), 4.0)

  // Yeni oranları hesapla
  const pr = poisson(lh, la), ht = poisson(lh*0.44, la*0.44)

  // MS oranlarını güncelle (Nesine oranları değişir — canlı maçta)
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

  await setMatches(matches)
  await setLastUpdate(new Date().toISOString())
  revalidatePath('/')

  const label = type === 'red_card' ? '🟥 Kırmızı kart' : '🤕 Sakatlık'
  const teamName = team === 'home' ? match.home.name : match.away.name
  const effect = type === 'red_card'
    ? `${teamName} λ -25%, rakip λ +15%`
    : `${teamName} λ -8%`

  return NextResponse.json({
    success: true,
    message: `${label} - ${teamName}${player ? ' ('+player+')' : ''}${minute ? ' '+minute+"'" : ''} → ${effect}`,
    newOdds: { ms1: match.ms.home.value, msX: match.ms.draw.value, ms2: match.ms.away.value }
  })
}
