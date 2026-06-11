'use client'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { MatchPrediction } from '@/lib/types'

interface Props { matches: MatchPrediction[] }
interface Team { name: string; flag: string; elo: number }
interface TeamRow extends Team { pts: number; expPts: number }
interface GroupResult { first: Team; second: Team; third: Team; standings: TeamRow[] }

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
  'Croatia':1933,'Ecuador':1933,'Norway':1922,'Germany':1910,
  'Switzerland':1897,'Uruguay':1890,'Turkey':1880,'Japan':1879,
  'Senegal':1869,'Denmark':1864,'Belgium':1849,'Morocco':1840,
  'Sweden':1860,'USA':1820,'Mexico':1810,'South Korea':1800,
  'Australia':1790,'Iran':1740,'Algeria':1730,'Austria':1730,
  'Ivory Coast':1710,'DR Congo':1700,'Tunisia':1680,'Paraguay':1670,
  'Saudi Arabia':1660,'South Africa':1650,'Scotland':1640,'Canada':1630,
  'Czech Republic':1620,'Ghana':1610,'Iraq':1600,'Jordan':1590,
  'Uzbekistan':1580,'Cape Verde':1570,'Bosnia & Herzegovina':1560,
  'New Zealand':1550,'Qatar':1540,'Egypt':1530,'Curaçao':1390,
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
function getTeam(n: string): Team { return { name: n, flag: FLAGS[n] ?? '🏳️', elo: ELO[n] ?? 1500 } }

let MATCH_PROBS: Record<string, number> = {}
function setMatchProbs(matches: MatchPrediction[]) {
  MATCH_PROBS = {}
  for (const m of matches) {
    MATCH_PROBS[`${m.home.name}__${m.away.name}`] = m.ms.home.probability
    MATCH_PROBS[`${m.away.name}__${m.home.name}`] = m.ms.away.probability
  }
}

function getWinProb(a: Team, b: Team): number {
  const key = `${a.name}__${b.name}`
  if (MATCH_PROBS[key] !== undefined) return MATCH_PROBS[key]
  return 1 / (1 + 10 ** ((b.elo - a.elo) / 400))
}

function beat(a?: Team, b?: Team): Team {
  const ta = a ?? BLANK, tb = b ?? BLANK
  if (ta.name === '?') return tb
  if (tb.name === '?') return ta
  return getWinProb(ta, tb) >= 0.5 ? ta : tb
}

function getGroupResults(matches: MatchPrediction[]): Record<string, GroupResult> {
  const realPts: Record<string, number> = {}
  const expPts:  Record<string, number> = {}

  for (const m of matches) {
    realPts[m.home.name] ??= 0; realPts[m.away.name] ??= 0
    expPts[m.home.name]  ??= 0; expPts[m.away.name]  ??= 0

    if (m.result) {
      const { homeScore: hs, awayScore: as_ } = m.result
      if (hs > as_)        { realPts[m.home.name] += 3 }
      else if (hs === as_) { realPts[m.home.name] += 1; realPts[m.away.name] += 1 }
      else                 { realPts[m.away.name] += 3 }
    } else {
      expPts[m.home.name] += m.ms.home.probability * 3 + m.ms.draw.probability
      expPts[m.away.name] += m.ms.away.probability * 3 + m.ms.draw.probability
    }
  }

  const res: Record<string, GroupResult> = {}
  for (const [g, teams] of Object.entries(GROUPS_DEF)) {
    const rows: TeamRow[] = teams.map(n => {
      const t  = getTeam(n)
      const rp = realPts[n] ?? 0
      const ep = expPts[n]  ?? 0
      return { ...t, pts: rp, expPts: Math.round((rp + ep) * 10) / 10 }
    }).sort((a, b) => b.expPts - a.expPts || b.elo - a.elo)

    res[g] = { first: rows[0] ?? BLANK, second: rows[1] ?? BLANK, third: rows[2] ?? BLANK, standings: rows }
  }
  return res
}

function simulate(gr: Record<string, GroupResult>) {
  const w  = (g: string) => gr[g]?.first  ?? BLANK
  const r  = (g: string) => gr[g]?.second ?? BLANK
  const t3 = (g: string) => gr[g]?.third  ?? BLANK

  const thirds = Object.keys(GROUPS_DEF).map(t3)
  const best8  = [...thirds].sort((a, b) => b.elo - a.elo).slice(0, 8)
  const b = (i: number) => best8[i] ?? BLANK

  const leftPairs: [Team,Team][] = [
    [r('A'), r('B')], [w('E'), b(0)], [w('F'), r('C')], [w('C'), r('F')],
    [r('E'), r('I')], [w('I'), b(1)], [w('A'), b(2)],   [w('L'), b(3)],
  ]
  const rightPairs: [Team,Team][] = [
    [r('K'), r('L')], [w('H'), r('J')], [w('B'), b(4)], [r('D'), r('G')],
    [w('J'), r('H')], [w('K'), b(5)],  [w('G'), b(6)],  [w('D'), b(7)],
  ]

  function playRound(pairs: [Team,Team][]): { winners: Team[]; nextPairs: [Team,Team][] } {
    const winners = pairs.map(([a, x]) => beat(a, x))
    const next: [Team,Team][] = []
    for (let i = 0; i < winners.length; i += 2) next.push([winners[i] ?? BLANK, winners[i+1] ?? BLANK])
    return { winners, nextPairs: next }
  }

  const lR16 = playRound(leftPairs);  const rR16 = playRound(rightPairs)
  const lQF  = playRound(lR16.nextPairs); const rQF = playRound(rR16.nextPairs)
  const lSF  = playRound(lQF.nextPairs);  const rSF = playRound(rQF.nextPairs)
  const lFinalist = lSF.winners[0] ?? BLANK
  const rFinalist = rSF.winners[0] ?? BLANK
  const champ = beat(lFinalist, rFinalist)

  return {
    leftPairs, rightPairs, best8,
    lR16w: lR16.winners, lR16p: lR16.nextPairs,
    rR16w: rR16.winners, rR16p: rR16.nextPairs,
    lQFw: lQF.winners,   lQFp: lQF.nextPairs,
    rQFw: rQF.winners,   rQFp: rQF.nextPairs,
    lSFw: lSF.winners,   lSFp: lSF.nextPairs,
    rSFw: rSF.winners,   rSFp: rSF.nextPairs,
    lFinalist, rFinalist, champ,
  }
}

function Slot({ team, win }: { team: Team; win: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 border-x border-t last:border-b first:rounded-t last:rounded-b w-[112px] overflow-hidden ${win ? 'bg-grass-500/15 border-grass-500/30' : 'bg-white/[0.02] border-white/8'}`}>
      <span className="text-sm flex-shrink-0">{team.flag}</span>
      <span className={`text-[10px] truncate font-mono ${win ? 'text-grass-300 font-medium' : team.name === '?' ? 'text-white/20' : 'text-white/65'}`}>
        {team.name === '?' ? 'TBD' : team.name}
      </span>
    </div>
  )
}

function MBox({ t1, t2, w }: { t1: Team; t2: Team; w: Team }) {
  return (
    <div className="flex flex-col">
      <Slot team={t1} win={w.name === t1.name && w.name !== '?'} />
      <Slot team={t2} win={w.name === t2.name && w.name !== '?'} />
    </div>
  )
}

function Col({ label, pairs, winners, gap }: { label: string; pairs: [Team,Team][]; winners: Team[]; gap: number }) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
      <div className="flex flex-col">
        {pairs.map(([t1, t2], i) => (
          <div key={i} style={{ marginTop: i === 0 ? 0 : gap }}>
            <MBox t1={t1} t2={t2} w={winners[i] ?? BLANK} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ColRight({ label, pairs, winners, gap }: { label: string; pairs: [Team,Team][]; winners: Team[]; gap: number }) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
      <div className="flex flex-col">
        {[...pairs].reverse().map(([t1, t2], i) => {
          const origIdx = pairs.length - 1 - i
          return (
            <div key={i} style={{ marginTop: i === 0 ? 0 : gap }}>
              <MBox t1={t1} t2={t2} w={winners[origIdx] ?? BLANK} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BracketClient({ matches }: Props) {
  setMatchProbs(matches)
  const groupResults = getGroupResults(matches)
  const sim = simulate(groupResults)

  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/bracket" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl sm:text-5xl text-chalk-50 tracking-wide">WORLD CUP 2026 BRACKET</h1>
          <p className="text-xs font-mono text-white/35 mt-2">32 takım · 24 grup çıkanı + 8 en iyi 3. · Model tahminleri</p>
        </div>

        <div className="mb-6 p-3 rounded-lg border border-white/8 bg-white/[0.02] flex flex-wrap gap-2 items-center">
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest mr-2">En iyi 8 üçüncü →</span>
          {sim.best8.map((t, i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded bg-gold-500/10 border border-gold-500/20">
              <span className="text-xs">{t.flag}</span>
              <span className="text-[10px] font-mono text-gold-300">{t.name}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pb-4 mb-10">
          <div className="flex items-start justify-center gap-0 min-w-max py-2">
            <Col label="R32" pairs={sim.leftPairs} winners={sim.lR16w} gap={3} />
            <div className="w-2 flex-shrink-0" />
            <Col label="R16" pairs={sim.lR16p} winners={sim.lQFw} gap={55} />
            <div className="w-2 flex-shrink-0" />
            <Col label="QF" pairs={sim.lQFp} winners={sim.lSFw} gap={113} />
            <div className="w-2 flex-shrink-0" />
            <Col label="SF" pairs={sim.lSFp} winners={[sim.lFinalist]} gap={229} />
            <div className="w-2 flex-shrink-0" />

            <div className="flex flex-col flex-shrink-0 items-center">
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">Final</div>
              <div style={{ marginTop: 229 }} className="flex flex-col items-center gap-3">
                <MBox t1={sim.lFinalist} t2={sim.rFinalist} w={sim.champ} />
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-3xl">{sim.champ.flag}</span>
                  <span className="text-[11px] font-mono text-gold-300 font-medium whitespace-nowrap">{sim.champ.name}</span>
                  <span className="text-[9px] font-mono text-white/25">🏆 Şampiyon</span>
                </div>
              </div>
            </div>

            <div className="w-2 flex-shrink-0" />
            <ColRight label="SF" pairs={sim.rSFp} winners={[sim.rFinalist]} gap={229} />
            <div className="w-2 flex-shrink-0" />
            <ColRight label="QF" pairs={sim.rQFp} winners={sim.rSFw} gap={113} />
            <div className="w-2 flex-shrink-0" />
            <ColRight label="R16" pairs={sim.rR16p} winners={sim.rQFw} gap={55} />
            <div className="w-2 flex-shrink-0" />
            <ColRight label="R32" pairs={sim.rightPairs} winners={sim.rR16w} gap={3} />
          </div>
        </div>

        <div className="border-t border-white/8 pt-8">
          <div className="flex items-center gap-3 mb-5">
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest">Grup Tabloları</p>
            <span className="text-[9px] font-mono text-white/15">Oynanmamış maçlar için ~ model tahmini</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.keys(GROUPS_DEF).map(g => (
              <div key={g} className="rounded-lg border border-white/8 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/8">
                  <span className="text-[10px] font-mono font-medium text-white/50 uppercase tracking-widest">Grup {g}</span>
                  <span className="text-[9px] font-mono text-white/20">Puan</span>
                </div>
                {groupResults[g].standings.map((t, i) => (
                  <div key={t.name} className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/5 last:border-b-0 ${i < 2 ? 'bg-grass-500/5' : sim.best8.some(b => b.name === t.name) ? 'bg-gold-500/5' : ''}`}>
                    <span className="text-xs flex-shrink-0">{t.flag}</span>
                    <span className={`flex-1 text-[10px] font-mono truncate ${i < 2 ? 'text-white/80' : sim.best8.some(b => b.name === t.name) ? 'text-gold-400' : 'text-white/35'}`}>{t.name}</span>
                    <div className="flex items-center gap-0.5">
                      <span className={`text-[10px] font-mono font-medium ${i < 2 ? 'text-grass-400' : 'text-white/25'}`}>
                        {t.pts > 0 ? t.pts : t.expPts.toFixed(1)}
                      </span>
                      {t.pts === 0 && t.expPts > 0 && (
                        <span className="text-[8px] font-mono text-white/20">~</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
