'use client'
import { MatchPrediction } from '@/lib/types'
import Link from 'next/link'

interface Props { matches: MatchPrediction[] }

// Her gruptan ilk 2 takımı ELO'ya göre belirle
function getGroupStandings(matches: MatchPrediction[]) {
  const groups: Record<string, Record<string, { name: string; flag: string; elo: number; pts: number }>> = {}

  for (const m of matches) {
    const g = m.group
    if (!groups[g]) groups[g] = {}
    const h = m.home, a = m.away
    if (!groups[g][h.name]) groups[g][h.name] = { name: h.name, flag: h.flag, elo: h.elo, pts: 0 }
    if (!groups[g][a.name]) groups[g][a.name] = { name: a.name, flag: a.flag, elo: a.elo, pts: 0 }

    // Biten maç varsa puan hesapla
    if (m.result) {
      const { homeScore, awayScore } = m.result
      if (homeScore > awayScore) { groups[g][h.name].pts += 3 }
      else if (homeScore === awayScore) { groups[g][h.name].pts += 1; groups[g][a.name].pts += 1 }
      else { groups[g][a.name].pts += 3 }
    } else {
      // Henüz oynanmadıysa MS olasılığına göre beklenen puan ekle
      groups[g][h.name].pts += m.ms.home.probability * 3 + m.ms.draw.probability
      groups[g][a.name].pts += m.ms.away.probability * 3 + m.ms.draw.probability
    }
  }

  // Her gruptan ilk 2'yi döndür
  const result: Record<string, Array<{ name: string; flag: string; elo: number }>> = {}
  for (const [g, teams] of Object.entries(groups)) {
    result[g] = Object.values(teams)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 2)
      .map(t => ({ name: t.name, flag: t.flag, elo: t.elo }))
  }
  return result
}

// WC 2026 R32 eşleşmeleri (resmi format)
// 1A vs 2B, 1C vs 2D, vb.
const R32_PAIRS = [
  ['A','B'],['C','D'],['E','F'],['G','H'],
  ['I','J'],['K','L'],['A','C'],['B','D'],
]

interface Team { name: string; flag: string; elo: number }

function matchWinner(t1: Team, t2: Team): Team {
  return t1.elo >= t2.elo ? t1 : t2
}

function simulateBracket(standings: Record<string, Team[]>) {
  // R32
  const r32: Array<[Team,Team]> = R32_PAIRS.map(([g1,g2]) => [
    standings[g1]?.[0] ?? { name: '?', flag: '🏳️', elo: 1500 },
    standings[g2]?.[1] ?? { name: '?', flag: '🏳️', elo: 1500 },
  ])
  const r32b: Array<[Team,Team]> = R32_PAIRS.map(([g1,g2]) => [
    standings[g2]?.[0] ?? { name: '?', flag: '🏳️', elo: 1500 },
    standings[g1]?.[1] ?? { name: '?', flag: '🏳️', elo: 1500 },
  ])
  const allR32 = [...r32, ...r32b]

  // R16 kazananlar
  const r16Winners = allR32.map(([a,b]) => matchWinner(a,b))

  // Çeyrek
  const qf: Array<[Team,Team]> = []
  for (let i = 0; i < r16Winners.length; i += 2) {
    qf.push([r16Winners[i], r16Winners[i+1]])
  }
  const qfWinners = qf.map(([a,b]) => matchWinner(a,b))

  // Yarı
  const sf: Array<[Team,Team]> = [
    [qfWinners[0], qfWinners[1]],
    [qfWinners[2], qfWinners[3]],
    [qfWinners[4], qfWinners[5]],
    [qfWinners[6], qfWinners[7]],
  ]
  const sfWinners = sf.map(([a,b]) => matchWinner(a,b))

  // Final
  const final: Array<[Team,Team]> = [
    [sfWinners[0], sfWinners[1]],
    [sfWinners[2], sfWinners[3]],
  ]
  const finalists = final.map(([a,b]) => matchWinner(a,b))
  const champion  = matchWinner(finalists[0], finalists[1])

  return { allR32, r16Winners, qf, qfWinners, sf, sfWinners, final, finalists, champion }
}

function TeamPill({ team, winner }: { team: Team; winner?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-mono transition-all ${
      winner
        ? 'bg-grass-500/20 border border-grass-500/40 text-chalk-100'
        : 'bg-white/[0.03] border border-white/8 text-white/60'
    }`}>
      <span className="text-sm">{team.flag}</span>
      <span className="truncate max-w-[72px]">{team.name}</span>
    </div>
  )
}

function MatchBox({ t1, t2, winner }: { t1: Team; t2: Team; winner: Team }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[130px]">
      <TeamPill team={t1} winner={winner.name === t1.name} />
      <TeamPill team={t2} winner={winner.name === t2.name} />
    </div>
  )
}

function RoundLabel({ label }: { label: string }) {
  return (
    <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-3 text-center">
      {label}
    </div>
  )
}

export default function BracketClient({ matches }: Props) {
  const standings = getGroupStandings(matches)
  const { allR32, r16Winners, qf, qfWinners, sf, sfWinners, final, finalists, champion } = simulateBracket(standings)

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
        <div className="mb-8">
          <h1 className="font-display text-4xl sm:text-6xl text-chalk-50 tracking-wide leading-none mb-2">
            TURNUVA<br /><span className="text-grass-400">BRACKET'I</span>
          </h1>
          <p className="text-xs font-mono text-white/35 mt-3">ELO modeline göre simüle edilmiş tahmin · Gerçek sonuçlar güncellendikçe değişir</p>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6 items-start min-w-max">

            {/* R32 */}
            <div>
              <RoundLabel label="Son 32" />
              <div className="flex flex-col gap-2">
                {allR32.map(([t1,t2], i) => (
                  <MatchBox key={i} t1={t1} t2={t2} winner={r16Winners[i]} />
                ))}
              </div>
            </div>

            {/* R16 */}
            <div>
              <RoundLabel label="Son 16" />
              <div className="flex flex-col gap-2" style={{paddingTop:'18px'}}>
                {qf.map(([t1,t2], i) => (
                  <div key={i} style={{marginBottom:'18px'}}>
                    <MatchBox t1={t1} t2={t2} winner={qfWinners[i]} />
                  </div>
                ))}
              </div>
            </div>

            {/* Çeyrek */}
            <div>
              <RoundLabel label="Çeyrek Final" />
              <div className="flex flex-col gap-2" style={{paddingTop:'54px'}}>
                {sf.map(([t1,t2], i) => (
                  <div key={i} style={{marginBottom:'54px'}}>
                    <MatchBox t1={t1} t2={t2} winner={sfWinners[i]} />
                  </div>
                ))}
              </div>
            </div>

            {/* Yarı */}
            <div>
              <RoundLabel label="Yarı Final" />
              <div className="flex flex-col gap-2" style={{paddingTop:'126px'}}>
                {final.map(([t1,t2], i) => (
                  <div key={i} style={{marginBottom:'126px'}}>
                    <MatchBox t1={t1} t2={t2} winner={finalists[i]} />
                  </div>
                ))}
              </div>
            </div>

            {/* Final & Şampiyon */}
            <div>
              <RoundLabel label="Final" />
              <div style={{paddingTop:'270px'}}>
                <MatchBox t1={finalists[0]} t2={finalists[1]} winner={champion} />
              </div>
            </div>

            {/* Şampiyon */}
            <div>
              <RoundLabel label="Şampiyon" />
              <div style={{paddingTop:'286px'}} className="flex flex-col items-center gap-2">
                <span className="text-3xl">{champion.flag}</span>
                <span className="text-[11px] font-mono text-gold-300 font-medium text-center">{champion.name}</span>
                <span className="text-[9px] font-mono text-gold-500">ELO {champion.elo}</span>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
