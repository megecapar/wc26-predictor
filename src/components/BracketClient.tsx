'use client'
import { MatchPrediction } from '@/lib/types'
import Link from 'next/link'

interface Props { matches: MatchPrediction[] }
interface Team { name: string; flag: string; elo: number }

const GROUPS_DEF: Record<string, string[]> = {
  A: ['Mexico','South Korea','South Africa','Czech Republic'],
  B: ['Canada','Switzerland','Qatar','Bosnia & Herzegovina'],
  C: ['Brazil','Morocco','Scotland','Haiti'],
  D: ['USA','Paraguay','Australia','Turkey'],
  E: ['Germany','Curaçao','Ivory Coast','Ecuador'],
  F: ['Netherlands','Japan','Sweden','Tunisia'],
  G: ['Belgium','Egypt','Iran','New Zealand'],
  H: ['Spain','Cape Verde','Saudi Arabia','Uruguay'],
  I: ['France','Senegal','Iraq','Norway'],
  J: ['Argentina','Algeria','Austria','Jordan'],
  K: ['Portugal','Uzbekistan','Colombia','DR Congo'],
  L: ['England','Croatia','Ghana','Panama'],
}

const ELO: Record<string, number> = {
  'Spain':2171,'Argentina':2113,'France':2063,'England':2042,
  'Colombia':1998,'Brazil':1979,'Portugal':1976,'Netherlands':1959,
  'Croatia':1933,'Norway':1922,'Germany':1910,'Switzerland':1897,
  'Uruguay':1890,'Turkey':1880,'Japan':1879,'Senegal':1869,
  'Denmark':1864,'Belgium':1849,'Morocco':1840,'Sweden':1860,
  'USA':1820,'Mexico':1810,'South Korea':1800,'Australia':1790,
  'Iran':1740,'Algeria':1730,'Austria':1730,'Ivory Coast':1710,
  'DR Congo':1700,'Tunisia':1680,'Paraguay':1670,'Saudi Arabia':1660,
  'South Africa':1650,'Scotland':1640,'Canada':1630,'Czech Republic':1620,
  'Ghana':1610,'Iraq':1600,'Jordan':1590,'Uzbekistan':1580,
  'Cape Verde':1570,'Bosnia & Herzegovina':1560,'New Zealand':1550,
  'Qatar':1540,'Egypt':1530,'Ecuador':1933,'Curaçao':1390,
  'Haiti':1380,'Panama':1360,
}

const FLAGS: Record<string, string> = {
  'Spain':'🇪🇸','Argentina':'🇦🇷','France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Colombia':'🇨🇴','Brazil':'🇧🇷','Portugal':'🇵🇹','Netherlands':'🇳🇱',
  'Croatia':'🇭🇷','Ecuador':'🇪🇨','Norway':'🇳🇴','Germany':'🇩🇪',
  'Switzerland':'🇨🇭','Uruguay':'🇺🇾','Turkey':'🇹🇷','Japan':'🇯🇵',
  'Senegal':'🇸🇳','Belgium':'🇧🇪','Morocco':'🇲🇦','Sweden':'🇸🇪',
  'USA':'🇺🇸','Mexico':'🇲🇽','South Korea':'🇰🇷','Australia':'🇦🇺',
  'Iran':'🇮🇷','Algeria':'🇩🇿','Ivory Coast':'🇨🇮','DR Congo':'🇨🇩',
  'Tunisia':'🇹🇳','Paraguay':'🇵🇾','Saudi Arabia':'🇸🇦','South Africa':'🇿🇦',
  'Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Canada':'🇨🇦','Czech Republic':'🇨🇿','Ghana':'🇬🇭',
  'Iraq':'🇮🇶','Jordan':'🇯🇴','Uzbekistan':'🇺🇿','Cape Verde':'🇨🇻',
  'Bosnia & Herzegovina':'🇧🇦','New Zealand':'🇳🇿','Qatar':'🇶🇦',
  'Haiti':'🇭🇹','Curaçao':'🇨🇼','Panama':'🇵🇦','Egypt':'🇪🇬','Austria':'🇦🇹',
}

const BLANK: Team = { name: '?', flag: '🏳️', elo: 0 }
function getTeam(n: string): Team { return { name: n, flag: FLAGS[n]??'🏳️', elo: ELO[n]??1500 } }

// Maç olasılık tablosu — matches_real.json'dan doldurulur
let MATCH_PROBS: Record<string, number> = {}

function setMatchProbs(matches: MatchPrediction[]) {
  MATCH_PROBS = {}
  for (const m of matches) {
    // key: "HomeTeam__AwayTeam" → ev sahibinin kazanma olasılığı
    MATCH_PROBS[`${m.home.name}__${m.away.name}`] = m.ms.home.probability
    MATCH_PROBS[`${m.away.name}__${m.home.name}`] = m.ms.away.probability
  }
}

function getWinProb(a: Team, b: Team): number {
  // Önce matches_real.json'daki olasılığa bak
  const key = `${a.name}__${b.name}`
  if (MATCH_PROBS[key] !== undefined) return MATCH_PROBS[key]
  // Yoksa ELO'dan hesapla
  return 1 / (1 + 10 ** ((b.elo - a.elo) / 400))
}

function beat(a?: Team, b?: Team): Team {
  const ta = a ?? BLANK, tb = b ?? BLANK
  if (ta.name === '?' || tb.name === '?') return ta.name !== '?' ? ta : tb
  // Olasılığa göre kazan (deterministik: %50+ kazanır)
  const pA = getWinProb(ta, tb)
  return pA >= 0.5 ? ta : tb
}

function getGroupResults(matches: MatchPrediction[]) {
  const pts: Record<string,number> = {}
  for (const m of matches) {
    pts[m.home.name]??=0; pts[m.away.name]??=0
    if (m.result) {
      const {homeScore:hs,awayScore:as_}=m.result
      if(hs>as_) pts[m.home.name]+=3
      else if(hs===as_){pts[m.home.name]++;pts[m.away.name]++}
      else pts[m.away.name]+=3
    } else {
      pts[m.home.name]+=m.ms.home.probability*3+m.ms.draw.probability
      pts[m.away.name]+=m.ms.away.probability*3+m.ms.draw.probability
    }
  }
  const res: Record<string,Team[]> = {}
  for (const [g,teams] of Object.entries(GROUPS_DEF)) {
    res[g] = teams.map(getTeam).sort((a,b)=>(pts[b.name]??0)-(pts[a.name]??0)||b.elo-a.elo)
  }
  return {standings: res, pts}
}

function simulate(standings: Record<string,Team[]>) {
  const w = (grp: string) => standings[grp]?.[0] ?? BLANK  // group winner
  const r = (grp: string) => standings[grp]?.[1] ?? BLANK  // runner-up
  const t3= (grp: string) => standings[grp]?.[2] ?? BLANK  // third place

  // En iyi 8 üçüncü (ELO sıralı)
  const thirds = Object.keys(GROUPS_DEF).map(t3)
  const best8  = [...thirds].sort((a,b)=>b.elo-a.elo).slice(0,8)
  // Üçüncü takımların hangi gruptan geldiğine göre eşleşme değişir
  // Basitleştirme: best8[0..7] = en iyi üçüncüler, ELO sıralı
  // Gerçekte 495 senaryo var, burada en yaygın olanı kullanıyoruz
  const b = (i: number) => best8[i] ?? BLANK

  // Resmi FIFA WC 2026 R32 eşleşmeleri (CBS Sports / NBC Sports kaynaklı)
  // Sol bracket — Match 73-80
  const leftPairs: [Team,Team][] = [
    [r('A'),  r('B') ],  // M73: 2A vs 2B
    [w('E'),  b(0)   ],  // M74: 1E vs best3rd (A/B/C/D/F)
    [w('F'),  r('C') ],  // M75: 1F vs 2C
    [w('C'),  r('F') ],  // M76: 1C vs 2F
    [r('E'),  r('I') ],  // M78: 2E vs 2I
    [w('I'),  b(1)   ],  // M77: 1I vs best3rd (C/D/F/G/H)
    [w('A'),  b(2)   ],  // M79: 1A vs best3rd (C/E/F/H/I)
    [w('L'),  b(3)   ],  // M80: 1L vs best3rd (E/H/I/J/K)
  ]
  // Sağ bracket — Match 81-88
  const rightPairs: [Team,Team][] = [
    [r('K'),  r('L') ],  // M83: 2K vs 2L
    [w('H'),  r('J') ],  // M84: 1H vs 2J
    [w('B'),  b(4)   ],  // M85: 1B vs best3rd (E/F/G/I/J)
    [r('D'),  r('G') ],  // M88: 2D vs 2G
    [w('J'),  r('H') ],  // M86: 1J vs 2H
    [w('K'),  b(5)   ],  // M87: 1K vs best3rd (D/E/I/J/L)
    [w('G'),  b(6)   ],  // M81: 1G vs best3rd (A/E/H/I/J)
    [w('D'),  b(7)   ],  // M82: 1D vs best3rd (B/E/F/I/J)
  ]

  function playRound(pairs:[Team,Team][]): {winners:Team[], nextPairs:[Team,Team][]} {
    const w = pairs.map(([a,b])=>beat(a,b))
    const next: [Team,Team][] = []
    for(let i=0;i<w.length;i+=2) next.push([w[i]??BLANK, w[i+1]??BLANK])
    return {winners:w, nextPairs:next}
  }

  const lR16 = playRound(leftPairs)
  const rR16 = playRound(rightPairs)
  const lQF  = playRound(lR16.nextPairs)
  const rQF  = playRound(rR16.nextPairs)
  const lSF  = playRound(lQF.nextPairs)
  const rSF  = playRound(rQF.nextPairs)

  const lFinalist = lSF.winners[0]??BLANK
  const rFinalist = rSF.winners[0]??BLANK
  const champ = beat(lFinalist, rFinalist)

  return {
    leftPairs, rightPairs,
    lR16w: lR16.winners, lR16p: lR16.nextPairs,
    rR16w: rR16.winners, rR16p: rR16.nextPairs,
    lQFw: lQF.winners, lQFp: lQF.nextPairs,
    rQFw: rQF.winners, rQFp: rQF.nextPairs,
    lSFw: lSF.winners, lSFp: lSF.nextPairs,
    rSFw: rSF.winners, rSFp: rSF.nextPairs,
    lFinalist, rFinalist, champ, best8,
  }
}

function Slot({ team, win }: { team: Team; win: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 border-x border-t last:border-b first:rounded-t last:rounded-b w-[112px] overflow-hidden ${win?'bg-grass-500/15 border-grass-500/30':'bg-white/[0.02] border-white/8'}`}>
      <span className="text-sm flex-shrink-0">{team.flag}</span>
      <span className={`text-[10px] truncate font-mono ${win?'text-grass-300 font-medium':team.name==='?'?'text-white/20':'text-white/65'}`}>
        {team.name==='?'?'TBD':team.name}
      </span>
    </div>
  )
}

function MBox({ t1, t2, w }: { t1:Team; t2:Team; w:Team }) {
  return (
    <div className="flex flex-col">
      <Slot team={t1} win={w.name===t1.name&&w.name!=='?'} />
      <Slot team={t2} win={w.name===t2.name&&w.name!=='?'} />
    </div>
  )
}

function Col({ label, pairs, winners, gap }: { label:string; pairs:[Team,Team][]; winners:Team[]; gap:number }) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
      <div className="flex flex-col">
        {pairs.map(([t1,t2],i) => (
          <div key={i} style={{marginTop:i===0?0:gap}}>
            <MBox t1={t1} t2={t2} w={winners[i]??BLANK} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Sağ taraf için ters sıralama (alttan yukarı)
function ColRight({ label, pairs, winners, gap }: { label:string; pairs:[Team,Team][]; winners:Team[]; gap:number }) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
      <div className="flex flex-col">
        {[...pairs].reverse().map(([t1,t2],i) => {
          const origIdx = pairs.length-1-i
          return (
            <div key={i} style={{marginTop:i===0?0:gap}}>
              <MBox t1={t1} t2={t2} w={winners[origIdx]??BLANK} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const GAP = 3

export default function BracketClient({ matches }: Props) {
  // Gelişmiş model olasılıklarını bracket'e yükle
  setMatchProbs(matches)
  const {standings, pts} = getGroupResults(matches)
  const sim = simulate(standings)

  return (
    <div className="min-h-screen pitch-stripes">
      <header className="border-b border-white/8 bg-black/20 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl font-display tracking-wider text-chalk-50 hover:text-grass-400 transition-colors">WC26</Link>
            <span className="text-[10px] font-mono text-grass-400 border border-grass-500/30 rounded px-1.5 py-0.5 bg-grass-500/10">PREDICTOR</span>
          </div>
          <nav className="flex gap-4 text-[11px] font-mono text-white/40">
            <Link href="/" className="hover:text-white/70 transition-colors">Maçlar</Link>
            <Link href="/bracket" className="text-white/80">Bracket</Link>
            <Link href="/standings" className="hover:text-white/70 transition-colors">Sıralama</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl sm:text-5xl text-chalk-50 tracking-wide">WORLD CUP 2026 BRACKET</h1>
          <p className="text-xs font-mono text-white/35 mt-2">32 takım · 24 grup çıkanı + 8 en iyi 3. · ELO modeli</p>
        </div>

        {/* En iyi 8 üçüncü */}
        <div className="mb-6 p-3 rounded-lg border border-white/8 bg-white/[0.02] flex flex-wrap gap-2 items-center">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest mr-2">En iyi 8 üçüncü →</span>
          {sim.best8.map((t,i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded bg-gold-500/10 border border-gold-500/20">
              <span className="text-xs">{t.flag}</span>
              <span className="text-[10px] font-mono text-gold-300">{t.name}</span>
            </div>
          ))}
        </div>

        {/* Çift taraflı bracket */}
        <div className="overflow-x-auto pb-4 mb-10">
          <div className="flex items-start justify-center gap-0 min-w-max py-2">

            {/* SOL TARAF */}
            <Col label="R32" pairs={sim.leftPairs} winners={sim.lR16w} gap={GAP} />
            <div className="w-2 flex-shrink-0" />
            <Col label="R16" pairs={sim.lR16p} winners={sim.lQFw} gap={55} />
            <div className="w-2 flex-shrink-0" />
            <Col label="QF" pairs={sim.lQFp} winners={sim.lSFw} gap={113} />
            <div className="w-2 flex-shrink-0" />
            <Col label="SF" pairs={sim.lSFp} winners={[sim.lFinalist]} gap={229} />
            <div className="w-2 flex-shrink-0" />

            {/* ORTA — FİNAL */}
            <div className="flex flex-col flex-shrink-0 items-center">
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">Final</div>
              <div style={{marginTop: 229}} className="flex flex-col items-center gap-3">
                <MBox t1={sim.lFinalist} t2={sim.rFinalist} w={sim.champ} />
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-3xl">{sim.champ.flag}</span>
                  <span className="text-[11px] font-mono text-gold-300 font-medium whitespace-nowrap">{sim.champ.name}</span>
                  <span className="text-[9px] font-mono text-white/25">🏆 Şampiyon</span>
                </div>
              </div>
            </div>

            {/* SAĞ TARAF */}
            <div className="w-2 flex-shrink-0" />
            <ColRight label="SF" pairs={sim.rSFp} winners={[sim.rFinalist]} gap={229} />
            <div className="w-2 flex-shrink-0" />
            <ColRight label="QF" pairs={sim.rQFp} winners={sim.rSFw} gap={113} />
            <div className="w-2 flex-shrink-0" />
            <ColRight label="R16" pairs={sim.rR16p} winners={sim.rQFw} gap={55} />
            <div className="w-2 flex-shrink-0" />
            <ColRight label="R32" pairs={sim.rightPairs} winners={sim.rR16w} gap={GAP} />
          </div>
        </div>

        {/* Grup tabloları */}
        <div className="border-t border-white/8 pt-8">
          <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-5">Grup Tabloları</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(GROUPS_DEF).map(([g, teams]) => {
              const sorted = teams.map(getTeam).sort((a,b)=>(pts[b.name]??0)-(pts[a.name]??0)||b.elo-a.elo)
              return (
                <div key={g} className="rounded-lg border border-white/8 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/8">
                    <span className="text-[10px] font-mono font-medium text-white/50 uppercase tracking-widest">Grup {g}</span>
                    <span className="text-[9px] font-mono text-white/20">ELO&nbsp;&nbsp;Puan</span>
                  </div>
                  {sorted.map((t,i) => (
                    <div key={t.name} className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/5 last:border-b-0 ${i<2?'bg-grass-500/5':sim.best8.some(b=>b.name===t.name)?'bg-gold-500/5':''}`}>
                      <span className="text-xs flex-shrink-0">{t.flag}</span>
                      <span className={`flex-1 text-[10px] font-mono truncate ${i<2?'text-white/80':sim.best8.some(b=>b.name===t.name)?'text-gold-400':'text-white/35'}`}>{t.name}</span>
                      <span className="text-[9px] font-mono text-white/25 w-8 text-right">{t.elo}</span>
                      <span className={`text-[10px] font-mono w-5 text-right font-medium ${i<2?'text-grass-400':'text-white/25'}`}>{Math.round(pts[t.name]??0)}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
