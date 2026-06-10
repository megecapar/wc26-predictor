'use client'
import { useState, useMemo, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { MatchPrediction } from '@/lib/types'
import { MatchCard } from '@/components/MatchCard'
import { Betslip } from '@/components/Betslip'
import { useBetslip } from '@/lib/betslip-context'
import { GroupFilter } from '@/components/GroupFilter'
import { cn } from '@/lib/utils'

function groupByDate(matches: MatchPrediction[]) {
  const map = new Map<string, MatchPrediction[]>()
  for (const m of matches) {
    const list = map.get(m.date) ?? []
    list.push(m)
    map.set(m.date, list)
  }
  return map
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface Props {
  matches: MatchPrediction[]
  lastUpdate: string | null
}

function MobileBetslip() {
  const { bets, totalOdds } = useBetslip()
  const [open, setOpen] = useState(false)

  if (bets.length === 0) return null

  return (
    <>
      {open && (
        <div className="bg-pitch-950/95 backdrop-blur-md border-t border-white/8 p-3 max-h-[60vh] overflow-y-auto">
          <Betslip />
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-grass-500 text-white font-mono text-sm"
      >
        <span>🎯 Kupon ({bets.length} seçim)</span>
        <span className="font-medium">Toplam: {totalOdds.toFixed(2)} {open ? '▼' : '▲'}</span>
      </button>
    </>
  )
}

export default function HomeClient({ matches: initialMatches, lastUpdate: initialLastUpdate }: Props) {
  const [matches,    setMatchesState] = useState(initialMatches)
  const [lastUpdate, setLastUpdate]   = useState(initialLastUpdate)
  const [group,      setGroup]        = useState('all')
  const [date,       setDate]         = useState('all')
  const [isLive,     setIsLive]       = useState(false)


  // Her 5 dakikada bir canlı güncelleme
  useEffect(() => {
    const refresh = async () => {
      try {
        // Canlı maç var mı kontrol et
        const liveRes = await fetch('/api/live')
        if (!liveRes.ok) return
        const liveData = await liveRes.json()

        // Bugün maç yoksa güncelleme yapma
        if (liveData.skipped) { setIsLive(false); return }
        setIsLive(true)

        // Güncel maç verisini çek
        const matchRes = await fetch('/api/matches', { cache: 'no-store' })
        if (!matchRes.ok) return
        const { matches: newMatches, lastUpdate: newTime } = await matchRes.json()
        if (newMatches?.length > 0) {
          setMatchesState(newMatches)
          setLastUpdate(newTime)
        }
      } catch { /* sessiz hata */ }
    }

    refresh()
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const groups = useMemo(() =>
    [...new Set(matches.map(m => m.group))].sort(), [matches]
  )

  const dates = useMemo(() =>
    [...new Set(matches.map(m => m.date))].sort(), [matches]
  )

  const filtered = useMemo(() =>
    matches
      .filter(m => group === 'all' || m.group === group)
      .filter(m => date  === 'all' || m.date  === date),
    [matches, group, date]
  )

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  return (
    <div className="min-h-screen pitch-stripes">
      <header className="border-b border-white/8 bg-black/20 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-display tracking-wider text-chalk-50">WC26</span>
            <span className="text-[10px] font-mono text-grass-400 border border-grass-500/30 rounded px-1.5 py-0.5 bg-grass-500/10">
              PREDICTOR
            </span>
            {isLive && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 bg-red-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                CANLI
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-4 text-[11px] font-mono text-white/40">
              <a href="/bracket" className="hover:text-white/70 transition-colors">Bracket</a>
              <a href="/standings" className="hover:text-white/70 transition-colors">Sıralama</a>
              <a href="/leaderboard" className="hover:text-white/70 transition-colors">Liderboard</a>
              {user ? (
                <a href="/profile" className="text-grass-400 hover:text-grass-300 transition-colors">@{user.email?.split('@')[0]}</a>
              ) : (
                <a href="/auth" className="hover:text-white/70 transition-colors">Giriş</a>
              )}
            </nav>
            {lastUpdate && (
              <span className="text-[10px] font-mono text-white/20 hidden sm:block">
                güncellendi: {new Date(lastUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-5xl sm:text-7xl text-chalk-50 tracking-wide leading-none mb-2">
            DÜNYA KUPASI<br />
            <span className="text-grass-400">TAHMİNLERİ</span>
          </h1>
          <p className="text-sm font-mono text-white/35 mt-3">
            49,000+ tarihi maç · ELO modeli · Poisson regresyon
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start pb-24 lg:pb-0">
          <div>
            <div className="mb-3">
              <GroupFilter value={group} onChange={setGroup} groups={groups} />
            </div>

            <div className="flex gap-2 flex-wrap mb-6">
              <button
                onClick={() => setDate('all')}
                className={cn(
                  'text-xs font-mono px-3 py-1.5 rounded-md border transition-all',
                  date === 'all'
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
                )}
              >
                Tüm günler
              </button>
              {dates.map(d => (
                <button
                  key={d}
                  onClick={() => setDate(d)}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-md border transition-all',
                    date === d
                      ? 'bg-white/10 text-white border-white/20'
                      : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
                  )}
                >
                  {new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </button>
              ))}
            </div>

            <div className="space-y-8">
              {Array.from(grouped.entries()).map(([d, dayMatches]) => (
                <div key={d}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-mono text-white/35 capitalize">{formatDate(d)}</span>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>
                  <div className="space-y-4">
                    {dayMatches.map(match => (
                      <MatchCard key={match.id} match={match} />
                    ))}
                  </div>
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-16 text-white/25 font-mono text-sm">
                  Bu filtre için maç bulunamadı.
                </div>
              )}
            </div>
          </div>

          {/* Masaüstü: sticky sidebar */}
          <div className="hidden lg:block lg:sticky lg:top-20 h-[calc(100vh-6rem)]">
            <Betslip />
          </div>
        </div>
      </main>

      {/* Mobil: sticky bottom kupon */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20">
        <MobileBetslip />
      </div>
    </div>
  )
}
