'use client'
import { Navbar } from '@/components/Navbar'
import { useState } from 'react'
import { MatchPrediction } from '@/lib/types'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS ?? 'wc26admin2026'

export default function AdminClient() {
  const [auth, setAuth]       = useState(false)
  const [pass, setPass]       = useState('')
  const [matches, setMatches] = useState<MatchPrediction[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState('')
  const [filter, setFilter]   = useState('')

  const [selectedMatch, setSelectedMatch] = useState('')
  const [homeScore, setHomeScore]         = useState('')
  const [awayScore, setAwayScore]         = useState('')
  const [xgHome, setXgHome]               = useState('')
  const [xgAway, setXgAway]               = useState('')

  const [eventMatch,  setEventMatch]  = useState('')
  const [eventType,   setEventType]   = useState<'red_card'|'injury'>('red_card')
  const [eventTeam,   setEventTeam]   = useState<'home'|'away'>('home')
  const [eventPlayer, setEventPlayer] = useState('')
  const [eventMinute, setEventMinute] = useState('')

  function login() {
    if (pass === ADMIN_PASS) { setAuth(true); loadMatches() }
    else setMsg('❌ Yanlış şifre')
  }

  async function loadMatches() {
    const res = await fetch('/api/matches')
    const data = await res.json()
    setMatches(data.matches ?? [])
  }

  async function submitScore() {
    if (!selectedMatch || homeScore === '' || awayScore === '') return
    setLoading(true); setMsg('')
    try {
      const body: Record<string, unknown> = {
        matchId: selectedMatch,
        homeScore: parseInt(homeScore),
        awayScore: parseInt(awayScore),
      }
      if (xgHome !== '') body.xgHome = parseFloat(xgHome)
      if (xgAway !== '') body.xgAway = parseFloat(xgAway)

      const res = await fetch('/api/admin/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_PASS}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setMsg(data.success ? `✅ ${data.message}` : `❌ ${data.error}`)
      if (data.success) {
        loadMatches()
        setHomeScore(''); setAwayScore('')
        setXgHome(''); setXgAway('')
        setSelectedMatch('')
      }
    } catch { setMsg('❌ Bağlantı hatası') }
    setLoading(false)
  }

  async function submitEvent() {
    if (!eventMatch) return
    setLoading(true); setMsg('')
    try {
      const res = await fetch('/api/admin/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_PASS}` },
        body: JSON.stringify({
          matchId: eventMatch, type: eventType, team: eventTeam,
          player: eventPlayer || undefined,
          minute: eventMinute ? parseInt(eventMinute) : undefined,
        }),
      })
      const data = await res.json()
      setMsg(data.success ? `✅ ${data.message}` : `❌ ${data.error}`)
      if (data.success) { loadMatches(); setEventPlayer(''); setEventMinute('') }
    } catch { setMsg('❌ Bağlantı hatası') }
    setLoading(false)
  }

  const filtered = matches.filter(m =>
    filter === '' ||
    m.home.name.toLowerCase().includes(filter.toLowerCase()) ||
    m.away.name.toLowerCase().includes(filter.toLowerCase())
  )
  const unplayed = filtered.filter(m => !m.result)
  const played   = filtered.filter(m => m.result)

  if (!auth) return (
    <div className="min-h-screen pitch-stripes flex items-center justify-center">
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 w-80">
        <h1 className="font-display text-2xl text-chalk-50 mb-6 text-center">ADMIN PANELİ</h1>
        <input type="password" placeholder="Şifre" value={pass}
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono mb-3 outline-none focus:border-grass-500/50"
        />
        <button onClick={login} className="w-full bg-grass-500 text-white rounded-lg py-2 text-sm font-mono hover:bg-grass-400 transition-colors">
          Giriş
        </button>
        {msg && <p className="text-xs font-mono text-red-400 mt-3 text-center">{msg}</p>}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/admin" />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {msg && (
          <div className={`p-3 rounded-lg border font-mono text-sm ${msg.startsWith('✅') ? 'bg-grass-500/10 border-grass-500/30 text-grass-300' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {msg}
          </div>
        )}

        <input type="text" placeholder="Takım ara..." value={filter} onChange={e => setFilter(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-white/20"
        />

        {/* SKOR GİRİŞİ */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5">
          <h2 className="text-sm font-mono font-medium text-chalk-100 mb-4 flex items-center gap-2">
            <span className="text-grass-400">⚽</span> Maç Sonucu Gir
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <select value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none">
              <option value="">Maç seç...</option>
              <optgroup label="— Oynanmamış —">
                {unplayed.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.home.flag} {m.home.name} vs {m.away.flag} {m.away.name} · {m.date}
                  </option>
                ))}
              </optgroup>
              {played.length > 0 && (
                <optgroup label="— Sonucu Düzelt —">
                  {played.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.home.flag} {m.home.name} {m.result?.homeScore}-{m.result?.awayScore} {m.away.flag} {m.away.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="flex gap-2">
              <input type="number" min="0" max="20" placeholder="Ev" value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 text-center" />
              <span className="flex items-center text-white/30 font-mono">-</span>
              <input type="number" min="0" max="20" placeholder="Dep" value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 text-center" />
            </div>
            <button onClick={submitScore} disabled={loading || !selectedMatch || homeScore === '' || awayScore === ''}
              className="bg-grass-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-mono hover:bg-grass-400 transition-colors">
              {loading ? 'Kaydediliyor...' : 'Kaydet & ELO Güncelle'}
            </button>
          </div>

          {/* xG Alanları */}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-white/35">
                xG Ev (opsiyonel) — SofaScore/FotMob&apos;dan bak
              </label>
              <input type="number" min="0" max="10" step="0.1" placeholder="ör: 1.8"
                value={xgHome} onChange={e => setXgHome(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 text-center"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-white/35">
                xG Deplasman (opsiyonel)
              </label>
              <input type="number" min="0" max="10" step="0.1" placeholder="ör: 0.9"
                value={xgAway} onChange={e => setXgAway(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 text-center"
              />
            </div>
          </div>
          <p className="text-[10px] font-mono text-white/25 mt-2">
            xG girilirse o takımın sonraki maçlarında lambda ayarlanır (+%15 etki)
          </p>
        </div>

        {/* OLAY GİRİŞİ */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5">
          <h2 className="text-sm font-mono font-medium text-chalk-100 mb-4 flex items-center gap-2">
            <span className="text-red-400">🟥</span> Kırmızı Kart / Sakatlık
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <select value={eventMatch} onChange={e => setEventMatch(e.target.value)}
              className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none">
              <option value="">Maç seç...</option>
              <optgroup label="— Oynanmamış —">
                {unplayed.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.home.flag} {m.home.name} vs {m.away.flag} {m.away.name}
                  </option>
                ))}
              </optgroup>
              {played.length > 0 && (
                <optgroup label="— Biten —">
                  {played.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.home.flag} {m.home.name} {m.result?.homeScore}-{m.result?.awayScore} {m.away.flag} {m.away.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <select value={eventType} onChange={e => setEventType(e.target.value as 'red_card'|'injury')}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none">
              <option value="red_card">🟥 Kırmızı Kart</option>
              <option value="injury">🤕 Sakatlık</option>
            </select>
            <select value={eventTeam} onChange={e => setEventTeam(e.target.value as 'home'|'away')}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none">
              <option value="home">Ev sahibi</option>
              <option value="away">Deplasman</option>
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input type="text" placeholder="Oyuncu adı (opsiyonel)" value={eventPlayer} onChange={e => setEventPlayer(e.target.value)}
              className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none" />
            <input type="number" min="1" max="120" placeholder="Dakika" value={eventMinute} onChange={e => setEventMinute(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none text-center" />
            <button onClick={submitEvent} disabled={loading || !eventMatch}
              className="bg-red-500/80 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-mono hover:bg-red-400 transition-colors">
              {loading ? 'Kaydediliyor...' : 'Oranları Güncelle'}
            </button>
          </div>
          <p className="text-[10px] font-mono text-white/30 mt-2">
            Kırmızı kart: o takımın lambda -25%, rakip +15% · Sakatlık: -8%
          </p>
        </div>

        {/* BİTEN MAÇLAR */}
        {played.length > 0 && (
          <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5">
            <h2 className="text-sm font-mono font-medium text-chalk-100 mb-4">✅ Biten Maçlar ({played.length})</h2>
            <div className="space-y-2">
              {played.map(m => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                    <span>{m.home.flag} {m.home.name}</span>
                    <span className="text-grass-400 font-medium">{m.result?.homeScore} - {m.result?.awayScore}</span>
                    <span>{m.away.name} {m.away.flag}</span>
                    {(m.result as {xgHome?: number})?.xgHome !== undefined && (
                      <span className="text-[10px] text-white/30 ml-2">
                        xG: {(m.result as {xgHome?: number}).xgHome} - {(m.result as {xgAway?: number}).xgAway}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-white/25">{m.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OYNANMAMIŞ MAÇLAR */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5">
          <h2 className="text-sm font-mono font-medium text-chalk-100 mb-4">📅 Oynanmamış Maçlar ({unplayed.length})</h2>
          <div className="space-y-1">
            {unplayed.slice(0, 20).map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-xs font-mono text-white/50">
                  <span>{m.home.flag} {m.home.name}</span>
                  <span className="text-white/25">vs</span>
                  <span>{m.away.name} {m.away.flag}</span>
                </div>
                <span className="text-[10px] font-mono text-white/25">{m.date} {m.kickoff}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
