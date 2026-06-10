'use client'
import { Navbar } from '@/components/Navbar'
import { useState, useEffect } from 'react'
import { MatchPrediction } from '@/lib/types'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS ?? 'wc26admin'

type MatchEvent = {
  type: 'red_card' | 'injury'
  team: 'home' | 'away'
  player?: string
  minute?: number
}

export default function AdminClient() {
  const [auth, setAuth]         = useState(false)
  const [pass, setPass]         = useState('')
  const [matches, setMatches]   = useState<MatchPrediction[]>([])
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [filter, setFilter]     = useState('')

  // Skor formu
  const [selectedMatch, setSelectedMatch] = useState<string>('')
  const [homeScore, setHomeScore]         = useState('')
  const [awayScore, setAwayScore]         = useState('')

  // Event formu
  const [eventMatch, setEventMatch]   = useState<string>('')
  const [eventType, setEventType]     = useState<'red_card'|'injury'>('red_card')
  const [eventTeam, setEventTeam]     = useState<'home'|'away'>('home')
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
      const res = await fetch('/api/admin/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ADMIN_PASS}` },
        body: JSON.stringify({
          matchId: selectedMatch,
          homeScore: parseInt(homeScore),
          awayScore: parseInt(awayScore),
        }),
      })
      const data = await res.json()
      setMsg(data.success ? `✅ Sonuç kaydedildi! ELO güncellendi.` : `❌ Hata: ${data.error}`)
      if (data.success) { loadMatches(); setHomeScore(''); setAwayScore(''); setSelectedMatch('') }
    } catch(e) { setMsg('❌ Bağlantı hatası') }
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
          matchId: eventMatch,
          type: eventType,
          team: eventTeam,
          player: eventPlayer,
          minute: eventMinute ? parseInt(eventMinute) : undefined,
        }),
      })
      const data = await res.json()
      setMsg(data.success ? `✅ Olay kaydedildi! Oranlar güncellendi.` : `❌ Hata: ${data.error}`)
      if (data.success) { loadMatches(); setEventPlayer(''); setEventMinute('') }
    } catch(e) { setMsg('❌ Bağlantı hatası') }
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
        <input
          type="password"
          placeholder="Şifre"
          value={pass}
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

        {/* Mesaj */}
        {msg && (
          <div className={`p-3 rounded-lg border font-mono text-sm ${msg.startsWith('✅') ? 'bg-grass-500/10 border-grass-500/30 text-grass-300' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {msg}
          </div>
        )}

        {/* Filtre */}
        <input
          type="text"
          placeholder="Takım ara..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-white/20"
        />

        {/* SKOR GİRİŞİ */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5">
          <h2 className="text-sm font-mono font-medium text-chalk-100 mb-4 flex items-center gap-2">
            <span className="text-grass-400">⚽</span> Maç Sonucu Gir
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <select
              value={selectedMatch}
              onChange={e => setSelectedMatch(e.target.value)}
              className="col-span-1 sm:col-span-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-white/20"
            >
              <option value="">Maç seç...</option>
              {unplayed.map(m => (
                <option key={m.id} value={m.id}>
                  {m.home.flag} {m.home.name} vs {m.away.flag} {m.away.name} · {m.date}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number" min="0" max="20"
                placeholder="Ev"
                value={homeScore}
                onChange={e => setHomeScore(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 text-center"
              />
              <span className="flex items-center text-white/30 font-mono text-sm">-</span>
              <input
                type="number" min="0" max="20"
                placeholder="Dep"
                value={awayScore}
                onChange={e => setAwayScore(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 text-center"
              />
            </div>
            <button
              onClick={submitScore}
              disabled={loading || !selectedMatch || homeScore === '' || awayScore === ''}
              className="bg-grass-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-mono hover:bg-grass-400 transition-colors"
            >
              {loading ? 'Kaydediliyor...' : 'Kaydet & ELO Güncelle'}
            </button>
          </div>
          {selectedMatch && (
            <p className="text-[10px] font-mono text-white/30">
              Sonuç kaydedilince ELO otomatik güncellenir, kalan maçların oranları yeniden hesaplanır.
            </p>
          )}
        </div>

        {/* OLAY GİRİŞİ */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-5">
          <h2 className="text-sm font-mono font-medium text-chalk-100 mb-4 flex items-center gap-2">
            <span className="text-red-400">🟥</span> Kırmızı Kart / Sakatlık
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <select
              value={eventMatch}
              onChange={e => setEventMatch(e.target.value)}
              className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none"
            >
              <option value="">Maç seç...</option>
              {unplayed.map(m => (
                <option key={m.id} value={m.id}>
                  {m.home.flag} {m.home.name} vs {m.away.flag} {m.away.name}
                </option>
              ))}
            </select>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value as 'red_card'|'injury')}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none"
            >
              <option value="red_card">🟥 Kırmızı Kart</option>
              <option value="injury">🤕 Sakatlık</option>
            </select>
            <select
              value={eventTeam}
              onChange={e => setEventTeam(e.target.value as 'home'|'away')}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none"
            >
              <option value="home">Ev sahibi</option>
              <option value="away">Deplasman</option>
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Oyuncu adı (opsiyonel)"
              value={eventPlayer}
              onChange={e => setEventPlayer(e.target.value)}
              className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none"
            />
            <input
              type="number" min="1" max="120"
              placeholder="Dakika"
              value={eventMinute}
              onChange={e => setEventMinute(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono outline-none text-center"
            />
            <button
              onClick={submitEvent}
              disabled={loading || !eventMatch}
              className="bg-red-500/80 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-mono hover:bg-red-400 transition-colors"
            >
              {loading ? 'Kaydediliyor...' : 'Oranları Güncelle'}
            </button>
          </div>
          <p className="text-[10px] font-mono text-white/30 mt-2">
            Kırmızı kart: o takımın lambda -25%, rakip +15% · Sakatlık (önemli oyuncu): -8%
          </p>
        </div>

        {/* BITEN MAÇLAR */}
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
                  </div>
                  <span className="text-[10px] font-mono text-white/25">{m.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OYNANMAMIS MAÇLAR */}
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
                <div className="flex items-center gap-3 text-[10px] font-mono text-white/25">
                  <span>{m.stage}</span>
                  <span>{m.date} {m.kickoff}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
