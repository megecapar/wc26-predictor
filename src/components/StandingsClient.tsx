'use client'
import { MatchPrediction } from '@/lib/types'
import Link from 'next/link'

interface Props { matches: MatchPrediction[] }

interface TeamStats {
  name: string; flag: string; group: string; elo: number
  champProb: number; finalProb: number; sfProb: number; qfProb: number
}

function simulate(matches: MatchPrediction[], runs = 5000): Record<string, TeamStats> {
  const teams: Record<string, TeamStats> = {}

  // Takımları topla
  for (const m of matches) {
    for (const t of [m.home, m.away]) {
      if (!teams[t.name]) {
        teams[t.name] = { name: t.name, flag: t.flag, group: m.group, elo: t.elo, champProb: 0, finalProb: 0, sfProb: 0, qfProb: 0 }
      }
    }
  }

  // Monte Carlo simülasyonu
  for (let r = 0; r < runs; r++) {
    // Gruplar
    const groupStandings: Record<string, string[]> = {}

    for (const m of matches) {
      if (!groupStandings[m.group]) groupStandings[m.group] = []
    }

    // Her grup için puan hesapla
    const pts: Record<string, number> = {}
    for (const m of matches) {
      const h = m.home.name, a = m.away.name
      pts[h] = pts[h] ?? 0; pts[a] = pts[a] ?? 0
      const r_ = Math.random()
      if (r_ < m.ms.home.probability) pts[h] += 3
      else if (r_ < m.ms.home.probability + m.ms.draw.probability) { pts[h] += 1; pts[a] += 1 }
      else pts[a] += 3
    }

    // Gruplardan çıkanları belirle
    const groupTeams: Record<string, Array<{name:string; elo:number}>> = {}
    for (const m of matches) {
      const g = m.group
      if (!groupTeams[g]) groupTeams[g] = []
      for (const t of [m.home, m.away]) {
        if (!groupTeams[g].find(x => x.name === t.name)) {
          groupTeams[g].push({ name: t.name, elo: t.elo })
        }
      }
    }

    const groupQualifiers: Record<string, [string,string]> = {}
    for (const [g, gTeams] of Object.entries(groupTeams)) {
      const sorted = gTeams.sort((a,b) => (pts[b.name]??0) - (pts[a.name]??0))
      groupQualifiers[g] = [sorted[0]?.name ?? '?', sorted[1]?.name ?? '?']
    }

    // Eleme turları
    const eloOf = (name: string) => teams[name]?.elo ?? 1500

    function play(a: string, b: string): string {
      const eA = eloOf(a), eB = eloOf(b)
      const pA = 1 / (1 + 10 ** ((eB - eA) / 400))
      return Math.random() < pA ? a : b
    }

    const groups = Object.keys(groupQualifiers).sort()
    const r32: string[] = []
    for (let i = 0; i < groups.length; i += 2) {
      const g1 = groups[i], g2 = groups[i+1]
      if (!g2) { r32.push(groupQualifiers[g1][0]); break }
      r32.push(groupQualifiers[g1][0])
      r32.push(groupQualifiers[g2][1])
      r32.push(groupQualifiers[g2][0])
      r32.push(groupQualifiers[g1][1])
    }

    function playRound(participants: string[]): string[] {
      const winners: string[] = []
      for (let i = 0; i < participants.length; i += 2) {
        if (!participants[i+1]) { winners.push(participants[i]); continue }
        winners.push(play(participants[i], participants[i+1]))
      }
      return winners
    }

    const r16 = playRound(r32)
    r16.forEach(t => { if (teams[t]) teams[t].qfProb += 1/runs })

    const qf = playRound(r16)
    qf.forEach(t => { if (teams[t]) teams[t].sfProb += 1/runs })

    const sf = playRound(qf)
    sf.forEach(t => { if (teams[t]) teams[t].finalProb += 1/runs })

    const final = playRound(sf)
    const champ = play(final[0] ?? '?', final[1] ?? '?')
    if (teams[champ]) teams[champ].champProb += 1/runs
  }

  return teams
}

export default function StandingsClient({ matches }: Props) {
  const teams = simulate(matches)
  const sorted = Object.values(teams).sort((a,b) => b.champProb - a.champProb)

  const fmt = (p: number) => `${(p * 100).toFixed(1)}%`

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
            <Link href="/bracket" className="hover:text-white/70 transition-colors">Bracket</Link>
            <Link href="/standings" className="text-white/80">Sıralama</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl sm:text-6xl text-chalk-50 tracking-wide leading-none mb-2">
            ŞAMPİYONLUK<br /><span className="text-grass-400">OLASILIKLARARI</span>
          </h1>
          <p className="text-xs font-mono text-white/35 mt-3">5,000 Monte Carlo simülasyonu · ELO modeli bazlı</p>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_repeat(4,6rem)] gap-0 px-4 py-3 border-b border-white/8 bg-white/[0.03]">
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">#</span>
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">Takım</span>
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-right">Çeyrek</span>
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-right">Yarı</span>
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-right">Final</span>
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-right">Şampiyon</span>
          </div>

          {sorted.map((t, i) => (
            <div key={t.name} className={`grid grid-cols-[2rem_1fr_repeat(4,6rem)] gap-0 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i === 0 ? 'bg-gold-500/5' : ''}`}>
              <span className={`text-xs font-mono ${i === 0 ? 'text-gold-400' : 'text-white/25'}`}>{i+1}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{t.flag}</span>
                <div>
                  <p className={`text-xs font-medium ${i === 0 ? 'text-chalk-100' : 'text-white/70'}`}>{t.name}</p>
                  <p className="text-[9px] font-mono text-white/30">Grup {t.group} · ELO {t.elo}</p>
                </div>
              </div>

              {/* Çeyrek bar */}
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-white/20 rounded-full" style={{width: fmt(t.qfProb)}} />
                  </div>
                  <span className="text-[10px] font-mono text-white/40 w-8 text-right">{fmt(t.qfProb)}</span>
                </div>
              </div>

              {/* Yarı bar */}
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-grass-500/50 rounded-full" style={{width: fmt(t.sfProb)}} />
                  </div>
                  <span className="text-[10px] font-mono text-white/40 w-8 text-right">{fmt(t.sfProb)}</span>
                </div>
              </div>

              {/* Final bar */}
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-grass-400/60 rounded-full" style={{width: fmt(t.finalProb)}} />
                  </div>
                  <span className="text-[10px] font-mono text-white/40 w-8 text-right">{fmt(t.finalProb)}</span>
                </div>
              </div>

              {/* Şampiyon */}
              <div className="flex items-center justify-end">
                <span className={`text-xs font-mono font-medium ${i === 0 ? 'text-gold-300' : i < 4 ? 'text-grass-400' : 'text-white/40'}`}>
                  {fmt(t.champProb)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
