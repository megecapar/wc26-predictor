'use client'
import { MatchPrediction } from '@/lib/types'
import Link from 'next/link'

interface Props { matches: MatchPrediction[] }
interface Team { name: string; flag: string; elo: number }
interface GroupResult { first: Team; second: Team; third: Team }

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
  'USA':1820,'Mexico':1810,'South Korea':1800,'Australia':1790,
  'Serbia':1780,'Poland':1770,'Chile':1760,'Peru':1750,
  'Iran':1740,'Algeria':1730,'Nigeria':1720,'Ivory Coast':1710,
  'DR Congo':1700,'Cameroon':1690,'Tunisia':1680,'Paraguay':1670,
  'Saudi Arabia':1660,'South Africa':1650,'Scotland':1640,'Canada':1630,
  'Czech Republic':1620,'Ghana':1610,'Iraq':1600,'Jordan':1590,
  'Uzbekistan':1580,'Cape Verde':1570,'Bosnia & Herzegovina':1560,
  'New Zealand':1550,'Qatar':1540,'Egypt':1530,'Sweden':1860,
  'Austria':1730,'Curaçao':1390,'Haiti':1380,'Panama':1360,
}

const FLAGS: Record<string, string> = {
  'Spain':'🇪🇸','Argentina':'🇦🇷','France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Colombia':'🇨🇴','Brazil':'🇧🇷','Portugal':'🇵🇹','Netherlands':'🇳🇱',
  'Croatia':'🇭🇷','Ecuador':'🇪🇨','Norway':'🇳🇴','Germany':'🇩🇪',
  'Switzerland':'🇨🇭','Uruguay':'🇺🇾','Turkey':'🇹🇷','Japan':'🇯🇵',
  'Senegal':'🇸🇳','Denmark':'🇩🇰','Belgium':'🇧🇪','Morocco':'🇲🇦',
  'USA':'🇺🇸','Mexico':'🇲🇽','South Korea':'🇰🇷','Australia':'🇦🇺',
  'Serbia':'🇷🇸','Poland':'🇵🇱','Chile':'🇨🇱','Peru':'🇵🇪',
  'Iran':'🇮🇷','Algeria':'🇩🇿','Nigeria':'🇳🇬','Ivory Coast':'🇨🇮',
  'DR Congo':'🇨🇩','Cameroon':'🇨🇲','Tunisia':'🇹🇳','Paraguay':'🇵🇾',
  'Saudi Arabia':'🇸🇦','South Africa':'🇿🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Canada':'🇨🇦',
  'Czech Republic':'🇨🇿','Ghana':'🇬🇭','Iraq':'🇮🇶','Jordan':'🇯🇴',
  'Uzbekistan':'🇺🇿','Cape Verde':'🇨🇻','Bosnia & Herzegovina':'🇧🇦',
  'New Zealand':'🇳🇿','Qatar':'🇶🇦','Haiti':'🇭🇹','Curaçao':'🇨🇼',
  'Panama':'🇵🇦','Egypt':'🇪🇬','Sweden':'🇸🇪','Austria':'🇦🇹',
}

const BLANK: Team = { name: '?', flag: '🏳️', elo: 0 }

function getTeam(name: string): Team {
  return { name, flag: FLAGS[name] ?? '🏳️', elo: ELO[name] ?? 1500 }
}

function beat(a?: Team, b?: Team): Team {
  const ta = a ?? BLANK, tb = b ?? BLANK
  return ta.elo >= tb.elo ? ta : tb
}

function getGroupResults(matches: MatchPrediction[]): Record<string, GroupResult> {
  const pts: Record<string, number> = {}

  for (const m of matches) {
    pts[m.home.name] ??= 0; pts[m.away.name] ??= 0
    if (m.result) {
      const { homeScore, awayScore } = m.result
      if (homeScore > awayScore) pts[m.home.name] += 3
      else if (homeScore === awayScore) { pts[m.home.name]++; pts[m.away.name]++ }
      else pts[m.away.name] += 3
    } else {
      pts[m.home.name] += m.ms.home.probability * 3 + m.ms.draw.probability
      pts[m.away.name] += m.ms.away.probability * 3 + m.ms.draw.probability
    }
  }

  const result: Record<string, GroupResult> = {}
  for (const [g, teams] of Object.entries(GROUPS_DEF)) {
    const sorted = teams.map(getTeam).sort((a, b) =>
      (pts[b.name] ?? 0) - (pts[a.name] ?? 0) || b.elo - a.elo
    )
    result[g] = {
      first:  sorted[0] ?? BLANK,
      second: sorted[1] ?? BLANK,
      third:  sorted[2] ?? BLANK,
    }
  }
  return result
}

function simulate(groupResults: Record<string, GroupResult>) {
  const groups = Object.keys(GROUPS_DEF).sort()

  // 24 grup çıkanı (1. ve 2.ler)
  const firsts  = groups.map(g => groupResults[g].first)
  const seconds = groups.map(g => groupResults[g].second)
  const thirds  = groups.map(g => groupResults[g].third)

  // En iyi 8 üçüncü (ELO'ya göre)
  const best8thirds = [...thirds]
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 8)

  // Round of 32: 16 maç
  // Resmi eşleşme: 1A vs 3DEF, 1B vs 3AEFG, vb. — basit simulasyon için ELO sıralaması
  const r32teams = [...firsts, ...seconds, ...best8thirds]
    .sort((a, b) => b.elo - a.elo)

  // Serpme bracket: 1. vs 32., 2. vs 31. şeklinde
  const r32pairs: [Team, Team][] = []
  for (let i = 0; i < 16; i++) {
    r32pairs.push([r32teams[i] ?? BLANK, r32teams[31 - i] ?? BLANK])
  }

  function playRound(pairs: [Team, Team][]): { winners: Team[], pairs: [Team, Team][] } {
    const winners = pairs.map(([a, b]) => beat(a, b))
    const nextPairs: [Team, Team][] = []
    for (let i = 0; i < winners.length; i += 2) {
      nextPairs.push([winners[i] ?? BLANK, winners[i + 1] ?? BLANK])
    }
    return { winners, pairs: nextPairs }
  }

  const r16 = playRound(r32pairs)
  const qf  = playRound(r16.pairs)
  const sf  = playRound(qf.pairs)
  const fin = playRound(sf.pairs)
  const champ = fin.winners[0] ?? BLANK

  return {
    r32pairs,
    r16winners: r16.winners, r16pairs: r16.pairs,
    qfwinners:  qf.winners,  qfpairs:  qf.pairs,
    sfwinners:  sf.winners,  sfpairs:  sf.pairs,
    finalists:  fin.pairs[0] ?? [BLANK, BLANK],
    champ,
    best8thirds,
  }
}

function TeamSlot({ team, winner }: { team: Team; winner: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 border-x border-t last:border-b first:rounded-t last:rounded-b min-w-[115px] max-w-[115px] overflow-hidden transition-colors ${winner ? 'bg-grass-500/15 border-grass-500/30' : 'bg-white/[0.02] border-white/8'}`}>
      <span className="text-sm flex-shrink-0">{team.flag}</span>
      <span className={`text-[10px] truncate font-mono ${winner ? 'text-grass-300 font-medium' : team.name === '?' ? 'text-white/20' : 'text-white/65'}`}>
        {team.name === '?' ? 'TBD' : team.name}
      </span>
    </div>
  )
}

function MatchBox({ t1, t2, winner }: { t1: Team; t2: Team; winner: Team }) {
  return (
    <div className="flex flex-col">
      <TeamSlot team={t1} winner={winner.name === t1.name && winner.name !== '?'} />
      <TeamSlot team={t2} winner={winner.name === t2.name && winner.name !== '?'} />
    </div>
  )
}

function RoundCol({ label, pairs, winners, gap }: {
  label: string; pairs: [Team, Team][]; winners: Team[]; gap: number
}) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">
        {label}
      </div>
      <div className="flex flex-col">
        {pairs.map(([t1, t2], i) => (
          <div key={i} style={{ marginTop: i === 0 ? 0 : gap }}>
            <MatchBox t1={t1} t2={t2} winner={winners[i] ?? BLANK} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BracketClient({ matches }: Props) {
  const groupResults = getGroupResults(matches)
  const { r32pairs, r16winners, r16pairs, qfwinners, qfpairs, sfwinners, sfpairs, finalists, champ, best8thirds } = simulate(groupResults)

  const pts: Record<string, number> = {}
  for (const m of matches) {
    pts[m.home.name] ??= 0; pts[m.away.name] ??= 0
    if (m.result) {
      const { homeScore, awayScore } = m.result
      if (homeScore > awayScore) pts[m.home.name] += 3
      else if (homeScore === awayScore) { pts[m.home.name]++; pts[m.away.name]++ }
      else pts[m.away.name] += 3
    }
  }

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
          <p className="text-xs font-mono text-white/35 mt-2">
            32 takım · 24 grup çıkanı + 8 en iyi 3. · ELO modeli
          </p>
        </div>

        {/* En iyi 8 üçüncü */}
        <div className="mb-6 p-3 rounded-lg border border-white/8 bg-white/[0.02]">
          <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">En İyi 8 Üçüncü (Son 32&apos;ye Kalan)</p>
          <div className="flex flex-wrap gap-2">
            {best8thirds.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-gold-500/10 border border-gold-500/20">
                <span className="text-xs">{t.flag}</span>
                <span className="text-[10px] font-mono text-gold-300">{t.name}</span>
                <span className="text-[9px] font-mono text-white/25">{t.elo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bracket */}
        <div className="overflow-x-auto pb-4 mb-10">
          <div className="flex items-start gap-0 min-w-max py-2">
            <RoundCol label={`Round of 32 (${r32pairs.length})`} pairs={r32pairs} winners={r16winners} gap={4} />
            <div className="w-3 flex-shrink-0" />
            <RoundCol label="Round of 16" pairs={r16pairs} winners={qfwinners} gap={62} />
            <div className="w-3 flex-shrink-0" />
            <RoundCol label="Quarterfinals" pairs={qfpairs} winners={sfwinners} gap={126} />
            <div className="w-3 flex-shrink-0" />
            <RoundCol label="Semifinals" pairs={sfpairs} winners={[finalists[0], finalists[1]]} gap={254} />
            <div className="w-3 flex-shrink-0" />

            {/* Final */}
            <div className="flex flex-col flex-shrink-0">
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">Final</div>
              <div style={{ marginTop: 510 }}>
                <MatchBox t1={finalists[0] ?? BLANK} t2={finalists[1] ?? BLANK} winner={champ} />
              </div>
            </div>
            <div className="w-3 flex-shrink-0" />

            {/* Şampiyon */}
            <div className="flex flex-col flex-shrink-0 items-center">
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">Şampiyon</div>
              <div style={{ marginTop: 516 }} className="flex flex-col items-center gap-1.5">
                <span className="text-4xl">{champ.flag}</span>
                <span className="text-xs font-mono text-gold-300 font-medium text-center whitespace-nowrap">{champ.name}</span>
                <span className="text-[9px] font-mono text-white/25">ELO {champ.elo}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grup tabloları */}
        <div className="border-t border-white/8 pt-8">
          <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-5">Grup Tabloları</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(GROUPS_DEF).map(([g, teams]) => {
              const sorted = teams.map(getTeam).sort((a, b) =>
                (pts[b.name] ?? 0) - (pts[a.name] ?? 0) || b.elo - a.elo
              )
              return (
                <div key={g} className="rounded-lg border border-white/8 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/8">
                    <span className="text-[10px] font-mono font-medium text-white/50 uppercase tracking-widest">Grup {g}</span>
                    <span className="text-[9px] font-mono text-white/20">ELO&nbsp;&nbsp;Puan</span>
                  </div>
                  {sorted.map((t, i) => (
                    <div key={t.name} className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/5 last:border-b-0 ${i < 2 ? 'bg-grass-500/5' : i === 2 && best8thirds.some(b => b.name === t.name) ? 'bg-gold-500/5' : ''}`}>
                      <span className="text-xs flex-shrink-0">{t.flag}</span>
                      <span className={`flex-1 text-[10px] font-mono truncate ${i < 2 ? 'text-white/80' : best8thirds.some(b => b.name === t.name) ? 'text-gold-400' : 'text-white/35'}`}>{t.name}</span>
                      <span className="text-[9px] font-mono text-white/25 w-8 text-right">{t.elo}</span>
                      <span className={`text-[10px] font-mono w-5 text-right font-medium ${i < 2 ? 'text-grass-400' : 'text-white/25'}`}>{pts[t.name] ?? 0}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <p className="text-[9px] font-mono text-white/20 mt-3">
            <span className="inline-block w-2 h-2 rounded-sm bg-grass-500/30 mr-1" />Grup çıkanı
            <span className="inline-block w-2 h-2 rounded-sm bg-gold-500/30 ml-3 mr-1" />En iyi 8 üçüncü
          </p>
        </div>
      </main>
    </div>
  )
}
