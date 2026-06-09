'use client'
import { MatchPrediction } from '@/lib/types'
import Link from 'next/link'

interface Props { matches: MatchPrediction[] }
interface Team { name: string; flag: string; elo: number }

// Resmi WC 2026 grupları + eloratings.net ELO (Haziran 2026)
const GROUPS_DEF: Record<string, { teams: string[] }> = {
  A: { teams: ['Mexico','South Korea','South Africa','Czech Republic'] },
  B: { teams: ['Canada','Switzerland','Qatar','Bosnia & Herzegovina'] },
  C: { teams: ['Brazil','Morocco','Scotland','Haiti'] },
  D: { teams: ['USA','Paraguay','Australia','Turkey'] },
  E: { teams: ['Germany','Curaçao','Ivory Coast','Ecuador'] },
  F: { teams: ['Netherlands','Japan','Sweden','Tunisia'] },
  G: { teams: ['Belgium','Egypt','Iran','New Zealand'] },
  H: { teams: ['Spain','Cape Verde','Saudi Arabia','Uruguay'] },
  I: { teams: ['France','Senegal','Iraq','Norway'] },
  J: { teams: ['Argentina','Algeria','Austria','Jordan'] },
  K: { teams: ['Portugal','Uzbekistan','Colombia','DR Congo'] },
  L: { teams: ['England','Croatia','Ghana','Panama'] },
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
  'New Zealand':1550,'Qatar':1540,'Haiti':1380,
  'Panama':1360,'Sweden':1860,'Egypt':1740,'Austria':1730,'Curaçao':1390,
  'Curaçao':1390,'Cape Verde':1570,
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
  'New Zealand':'🇳🇿','Qatar':'🇶🇦','Haiti':'🇭🇹','Curaçao':'🇨🇼','Panama':'🇵🇦',
}

function getTeam(name: string): Team {
  return { name, flag: FLAGS[name] ?? '🏳️', elo: ELO[name] ?? 1500 }
}

const BLANK: Team = { name: '?', flag: '🏳️', elo: 0 }

function beat(a?: Team, b?: Team): Team {
  const ta = a ?? BLANK, tb = b ?? BLANK
  return ta.elo >= tb.elo ? ta : tb
}

function getGroupWinners(matches: MatchPrediction[]): Record<string, [Team, Team]> {
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

  const result: Record<string, [Team, Team]> = {}
  for (const [g, { teams }] of Object.entries(GROUPS_DEF)) {
    const sorted = teams.map(getTeam).sort((a, b) =>
      (pts[b.name] ?? 0) - (pts[a.name] ?? 0) || b.elo - a.elo
    )
    result[g] = [sorted[0] ?? BLANK, sorted[1] ?? BLANK]
  }
  return result
}

function simulate(gw: Record<string, [Team, Team]>) {
  const groups = Object.keys(GROUPS_DEF).sort()
  const r32: [Team, Team][] = []
  for (let i = 0; i < groups.length; i += 2) {
    const g1 = groups[i], g2 = groups[i + 1] ?? groups[0]
    r32.push([gw[g1]?.[0] ?? BLANK, gw[g2]?.[1] ?? BLANK])
    r32.push([gw[g2]?.[0] ?? BLANK, gw[g1]?.[1] ?? BLANK])
  }
  const r16w = r32.map(([a, b]) => beat(a, b))
  const qfP: [Team,Team][] = []; for (let i = 0; i < r16w.length; i+=2) qfP.push([r16w[i], r16w[i+1]])
  const qfw = qfP.map(([a,b]) => beat(a,b))
  const sfP: [Team,Team][] = []; for (let i = 0; i < qfw.length; i+=2) sfP.push([qfw[i], qfw[i+1]])
  const sfw = sfP.map(([a,b]) => beat(a,b))
  const fP:  [Team,Team][] = []; for (let i = 0; i < sfw.length; i+=2) fP.push([sfw[i], sfw[i+1]])
  const fw  = fP.map(([a,b]) => beat(a,b))
  const champ = fw.length >= 2 ? beat(fw[0], fw[1]) : (fw[0] ?? BLANK)
  return { r32, r16w, qfP, qfw, sfP, sfw, fP, fw, champ }
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

function RoundCol({ label, pairs, winners, gap }: { label: string; pairs: [Team,Team][]; winners: Team[]; gap: number }) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
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
  const gw = getGroupWinners(matches)
  const { r32, r16w, qfP, qfw, sfP, sfw, fP, fw, champ } = simulate(gw)
  const r16pairs: [Team,Team][] = []; for (let i = 0; i < r16w.length; i+=2) r16pairs.push([r16w[i], r16w[i+1]])

  // Grup tablosu için maç puanları
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
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl sm:text-5xl text-chalk-50 tracking-wide">WORLD CUP 2026 BRACKET</h1>
          <p className="text-xs font-mono text-white/35 mt-2">eloratings.net ELO verileri · Maçlar oynanınca otomatik güncellenir</p>
        </div>

        {/* Bracket */}
        <div className="overflow-x-auto pb-4 mb-10">
          <div className="flex items-start gap-0 min-w-max py-2">
            <RoundCol label="Round of 32" pairs={r32} winners={r16w} gap={4} />
            <div className="w-3 flex-shrink-0" />
            <RoundCol label="Round of 16" pairs={r16pairs} winners={qfw} gap={62} />
            <div className="w-3 flex-shrink-0" />
            <RoundCol label="Quarterfinals" pairs={qfP} winners={sfw} gap={126} />
            <div className="w-3 flex-shrink-0" />
            <RoundCol label="Semifinals" pairs={sfP} winners={fw} gap={254} />
            <div className="w-3 flex-shrink-0" />

            {/* Final */}
            <div className="flex flex-col flex-shrink-0">
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">Final</div>
              <div style={{ marginTop: 510 }}>
                {fP[0] && <MatchBox t1={fP[0][0]} t2={fP[0][1]} winner={champ} />}
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
            {Object.entries(GROUPS_DEF).map(([g, { teams }]) => {
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
                    <div key={t.name} className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/5 last:border-b-0 ${i < 2 ? 'bg-grass-500/5' : ''}`}>
                      <span className="text-xs flex-shrink-0">{t.flag}</span>
                      <span className={`flex-1 text-[10px] font-mono truncate ${i < 2 ? 'text-white/80' : 'text-white/35'}`}>{t.name}</span>
                      <span className="text-[9px] font-mono text-white/25 w-8 text-right">{t.elo}</span>
                      <span className={`text-[10px] font-mono w-5 text-right font-medium ${i < 2 ? 'text-grass-400' : 'text-white/25'}`}>{pts[t.name] ?? 0}</span>
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
