'use client'
import { useState } from 'react'
import { MatchPrediction } from '@/lib/types'
import { Navbar } from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
import Link from 'next/link'

interface Props { matches: MatchPrediction[] }

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

const FLAGS: Record<string, string> = {
  'Spain':'🇪🇸','Argentina':'🇦🇷','France':'🇫🇷','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Colombia':'🇨🇴',
  'Brazil':'🇧🇷','Portugal':'🇵🇹','Netherlands':'🇳🇱','Croatia':'🇭🇷','Ecuador':'🇪🇨',
  'Norway':'🇳🇴','Germany':'🇩🇪','Switzerland':'🇨🇭','Uruguay':'🇺🇾','Turkey':'🇹🇷',
  'Japan':'🇯🇵','Senegal':'🇸🇳','Belgium':'🇧🇪','Morocco':'🇲🇦','Sweden':'🇸🇪',
  'USA':'🇺🇸','Mexico':'🇲🇽','South Korea':'🇰🇷','Australia':'🇦🇺','Iran':'🇮🇷',
  'Algeria':'🇩🇿','Ivory Coast':'🇨🇮','DR Congo':'🇨🇩','Tunisia':'🇹🇳','Paraguay':'🇵🇾',
  'Saudi Arabia':'🇸🇦','South Africa':'🇿🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Canada':'🇨🇦',
  'Czech Republic':'🇨🇿','Ghana':'🇬🇭','Iraq':'🇮🇶','Jordan':'🇯🇴','Uzbekistan':'🇺🇿',
  'Cape Verde':'🇨🇻','Bosnia & Herzegovina':'🇧🇦','New Zealand':'🇳🇿','Qatar':'🇶🇦',
  'Haiti':'🇭🇹','Curaçao':'🇨🇼','Panama':'🇵🇦','Egypt':'🇪🇬','Austria':'🇦🇹',
}

function gf(n: string) { return FLAGS[n] ?? '🏳️' }

// --- Bracket Bileşeni ---
interface BracketState {
  r32:   Record<number, string>
  r16:   Record<number, string>
  qf:    Record<number, string>
  sf:    Record<number, string>
  final: Record<number, string>
}

function Slot({ team, isWinner, onClick }: { team: string; isWinner: boolean; onClick?: () => void }) {
  const isTbd = !team || team === '?'
  return (
    <button
      onClick={onClick}
      disabled={isTbd || !onClick}
      className={`flex items-center gap-1.5 px-2 py-1.5 w-[118px] border-x border-t last:border-b first:rounded-t last:rounded-b overflow-hidden transition-colors font-mono text-[10px] disabled:cursor-default
        ${isWinner
          ? 'bg-grass-500/15 border-grass-500/35 text-grass-300 font-medium'
          : isTbd
            ? 'bg-white/[0.02] border-white/8 text-white/20'
            : 'bg-white/[0.02] border-white/8 text-white/55 hover:bg-white/8 cursor-pointer'
        }`}
    >
      <span className="text-sm flex-shrink-0">{isTbd ? '🏳️' : gf(team)}</span>
      <span className="truncate">{isTbd ? 'TBD' : team}</span>
    </button>
  )
}

function MatchBox({ t1, t2, winner, onPick }: { t1: string; t2: string; winner: string; onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col">
      <Slot team={t1} isWinner={winner === t1 && !!t1 && t1 !== '?'} onClick={t1 && t1 !== '?' ? () => onPick(t1) : undefined} />
      <Slot team={t2} isWinner={winner === t2 && !!t2 && t2 !== '?'} onClick={t2 && t2 !== '?' ? () => onPick(t2) : undefined} />
    </div>
  )
}

function RoundCol({ label, pairs, winners, gap, reverse, onPick }: {
  label: string
  pairs: [string, string][]
  winners: string[]
  gap: number
  reverse?: boolean
  onPick: (round: string, idx: number, team: string) => void
}) {
  const list = reverse ? [...pairs].map((p, i) => ({ p, orig: pairs.length - 1 - i })).reverse() : pairs.map((p, i) => ({ p, orig: i }))
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
      <div className="flex flex-col">
        {list.map(({ p: [t1, t2], orig }, i) => (
          <div key={i} style={{ marginTop: i === 0 ? 0 : gap }}>
            <MatchBox
              t1={t1} t2={t2}
              winner={winners[orig] ?? ''}
              onPick={(t) => onPick(label, orig, t)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketEditor({ r32Pairs, state, onPick }: {
  r32Pairs: [string, string][]
  state: BracketState
  onPick: (round: string, idx: number, team: string) => void
}) {
  const lR32 = r32Pairs.slice(0, 8)
  const rR32 = r32Pairs.slice(8, 16)

  const lR32w = lR32.map((_, i) => state.r32[i] ?? '?')
  const rR32w = rR32.map((_, i) => state.r32[i + 8] ?? '?')

  const lR16: [string, string][] = [[lR32w[0], lR32w[1]], [lR32w[2], lR32w[3]], [lR32w[4], lR32w[5]], [lR32w[6], lR32w[7]]]
  const rR16: [string, string][] = [[rR32w[0], rR32w[1]], [rR32w[2], rR32w[3]], [rR32w[4], rR32w[5]], [rR32w[6], rR32w[7]]]
  const lR16w = lR16.map((_, i) => state.r16[i] ?? '?')
  const rR16w = rR16.map((_, i) => state.r16[i + 4] ?? '?')

  const lQF: [string, string][] = [[lR16w[0], lR16w[1]], [lR16w[2], lR16w[3]]]
  const rQF: [string, string][] = [[rR16w[0], rR16w[1]], [rR16w[2], rR16w[3]]]
  const lQFw = lQF.map((_, i) => state.qf[i] ?? '?')
  const rQFw = rQF.map((_, i) => state.qf[i + 2] ?? '?')

  const lSF: [string, string][] = [[lQFw[0], lQFw[1]]]
  const rSF: [string, string][] = [[rQFw[0], rQFw[1]]]
  const lSFw = state.sf[0] ?? '?'
  const rSFw = state.sf[1] ?? '?'
  const champion = state.final[0] ?? '?'

  const GAP = 3

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-start justify-center gap-0 min-w-max py-1">

        <RoundCol label="R32" pairs={lR32} winners={lR32.map((_, i) => state.r32[i] ?? '')} gap={GAP} onPick={onPick} />
        <div className="w-2 flex-shrink-0" />
        <RoundCol label="R16" pairs={lR16} winners={lR16w.map((w, i) => state.r16[i] ?? '')} gap={55} onPick={onPick} />
        <div className="w-2 flex-shrink-0" />
        <RoundCol label="QF" pairs={lQF} winners={lQF.map((_, i) => state.qf[i] ?? '')} gap={167} onPick={onPick} />
        <div className="w-2 flex-shrink-0" />

        {/* Sol SF */}
        <div className="flex flex-col flex-shrink-0">
          <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">SF</div>
          <MatchBox t1={lQFw[0]} t2={lQFw[1]} winner={lSFw} onPick={(t) => onPick('SF', 0, t)} />
        </div>
        <div className="w-2 flex-shrink-0" />

        {/* Final ortada */}
        <div className="flex flex-col flex-shrink-0 items-center">
          <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">Final</div>
          <div style={{ marginTop: 44 }}>
            <MatchBox t1={lSFw} t2={rSFw} winner={champion} onPick={(t) => onPick('Final', 0, t)} />
          </div>
          {champion && champion !== '?' && (
            <div className="flex flex-col items-center gap-1 mt-3">
              <span className="text-2xl">{gf(champion)}</span>
              <span className="text-[10px] font-mono text-gold-300 font-medium whitespace-nowrap">{champion}</span>
              <span className="text-[9px] font-mono text-white/25">🏆 Şampiyon</span>
            </div>
          )}
        </div>

        <div className="w-2 flex-shrink-0" />
        {/* Sağ SF */}
        <div className="flex flex-col flex-shrink-0">
          <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">SF</div>
          <MatchBox t1={rQFw[0]} t2={rQFw[1]} winner={rSFw} onPick={(t) => onPick('SF', 1, t)} />
        </div>
        <div className="w-2 flex-shrink-0" />

        <RoundCol label="QF" pairs={rQF} winners={rQF.map((_, i) => state.qf[i + 2] ?? '')} gap={167} reverse onPick={onPick} />
        <div className="w-2 flex-shrink-0" />
        <RoundCol label="R16" pairs={rR16} winners={rR16.map((_, i) => state.r16[i + 4] ?? '')} gap={55} reverse onPick={onPick} />
        <div className="w-2 flex-shrink-0" />
        <RoundCol label="R32" pairs={rR32} winners={rR32.map((_, i) => state.r32[i + 8] ?? '')} gap={GAP} reverse onPick={onPick} />
      </div>
    </div>
  )
}

// --- Ana Sayfa ---
const STEPS = ['Gruplar', 'Bracket']

export default function PredictClient({ matches: _matches }: Props) {
  const { userId } = useUser()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState('')

  // Grup seçimleri
  const [groups, setGroups] = useState<Record<string, [string, string]>>({})
  const [selectedThirds, setSelectedThirds] = useState<string[]>([])

  // Bracket state
  const [bracketState, setBracketState] = useState<BracketState>({
    r32: {}, r16: {}, qf: {}, sf: {}, final: {}
  })

  function selectGroupTeam(g: string, team: string) {
    const current = groups[g] ?? ['', '']
    if (current[0] === team) { setGroups(prev => ({ ...prev, [g]: ['', current[1]] })); return }
    if (current[1] === team) { setGroups(prev => ({ ...prev, [g]: [current[0], ''] })); return }
    if (!current[0]) { setGroups(prev => ({ ...prev, [g]: [team, current[1]] })); return }
    if (!current[1]) { setGroups(prev => ({ ...prev, [g]: [current[0], team] })); return }
    setSelectedThirds(prev =>
      prev.includes(team) ? prev.filter(x => x !== team) : prev.length < 8 ? [...prev, team] : prev
    )
  }

  const allGroupsDone = Object.keys(GROUPS_DEF).every(g => groups[g]?.[0] && groups[g]?.[1])
  const groupsDone = allGroupsDone && selectedThirds.length === 8

  // R32 eşleşmeleri (resmi WC 2026 formatı)
  function getR32Pairs(): [string, string][] {
    const w = (g: string) => groups[g]?.[0] ?? '?'
    const r = (g: string) => groups[g]?.[1] ?? '?'
    const b = (i: number) => selectedThirds[i] ?? '?'
    return [
      [r('A'), r('B')], [w('E'), b(0)], [w('F'), r('C')], [w('C'), r('F')],
      [r('E'), r('I')], [w('I'), b(1)], [w('A'), b(2)],   [w('L'), b(3)],
      [r('K'), r('L')], [w('H'), r('J')], [w('B'), b(4)], [r('D'), r('G')],
      [w('J'), r('H')], [w('K'), b(5)],  [w('G'), b(6)],  [w('D'), b(7)],
    ]
  }

  function handlePick(round: string, idx: number, team: string) {
    const roundMap: Record<string, keyof BracketState> = {
      'R32': 'r32', 'R16': 'r16', 'QF': 'qf', 'SF': 'sf', 'Final': 'final'
    }
    const key = roundMap[round]
    if (!key) return
    setBracketState(prev => ({ ...prev, [key]: { ...prev[key], [idx]: team } }))
  }

  const champion = bracketState.final[0] ?? ''

  async function saveBracket() {
    if (!userId || !champion) return
    setSaving(true)
    const bracket = { groups, selectedThirds, ...bracketState, champion }
    const { error } = await supabase.from('user_brackets').upsert({
      user_id: userId, bracket, champion,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) setMsg('❌ ' + error.message)
    else { setSaved(true); setMsg('✅ Bracket kaydedildi!') }
    setSaving(false)
  }

  function shareTwitter() {
    const text = encodeURIComponent(
      `WC 2026 Bracket Tahminim 🏆\nŞampiyon: ${gf(champion)} ${champion}\nhttps://wc26-predictor-orcin.vercel.app/predict #FIFA2026`
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}`)
  }

  function shareWhatsapp() {
    const text = encodeURIComponent(
      `WC 2026 Bracket Tahminim 🏆\nŞampiyon: ${gf(champion)} ${champion}\nhttps://wc26-predictor-orcin.vercel.app/predict`
    )
    window.open(`https://wa.me/?text=${text}`)
  }

  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/predict" />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-4xl sm:text-5xl text-chalk-50 tracking-wide">
            TAHMİN<br /><span className="text-grass-400">BRACKET&apos;İN</span>
          </h1>
          <p className="text-xs font-mono text-white/35 mt-2">Grupları seç · Bracket&apos;te ilerle · Kaydet</p>
        </div>

        {/* Step bar */}
        <div className="flex gap-0 mb-8 rounded-lg overflow-hidden border border-white/8 w-fit">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => i < step ? setStep(i) : undefined}
              className={`px-6 py-2 text-xs font-mono transition-colors ${i === step ? 'bg-grass-500/20 text-grass-300' : i < step ? 'bg-white/5 text-white/50 hover:bg-white/8 cursor-pointer' : 'bg-white/[0.02] text-white/20'}`}>
              {i < step ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>

        {/* STEP 0 — Gruplar */}
        {step === 0 && (
          <div>
            <p className="text-xs font-mono text-white/40 mb-1">
              1. tıklama → 1. sıra · 2. tıklama → 2. sıra · 3. takıma tıklama → en iyi 8 üçüncü ★
            </p>
            <p className="text-[10px] font-mono text-white/25 mb-4">
              En iyi 8 üçüncü: {selectedThirds.length}/8 seçildi
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
              {Object.entries(GROUPS_DEF).map(([g, teams]) => {
                const sel = groups[g] ?? ['', '']
                return (
                  <div key={g} className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-white/[0.04] border-b border-white/8 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Grup {g}</span>
                      <div className="flex gap-1">
                        {sel[0] && <span className="text-[9px] font-mono text-grass-400 bg-grass-500/10 px-1.5 py-0.5 rounded">1. {gf(sel[0])}</span>}
                        {sel[1] && <span className="text-[9px] font-mono text-grass-300 bg-grass-500/10 px-1.5 py-0.5 rounded">2. {gf(sel[1])}</span>}
                      </div>
                    </div>
                    {teams.map(t => {
                      const isFirst = sel[0] === t
                      const isSecond = sel[1] === t
                      const isThird = !isFirst && !isSecond
                      const inBest8 = selectedThirds.includes(t)
                      return (
                        <button key={t} onClick={() => selectGroupTeam(g, t)}
                          className={`w-full flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 transition-colors ${isFirst ? 'bg-grass-500/15' : isSecond ? 'bg-grass-500/8' : inBest8 ? 'bg-gold-500/10' : 'hover:bg-white/5'}`}>
                          <span className="text-base">{gf(t)}</span>
                          <span className={`text-xs font-mono flex-1 text-left ${isFirst || isSecond ? 'text-white/90' : inBest8 ? 'text-gold-300' : 'text-white/50'}`}>{t}</span>
                          {isFirst  && <span className="text-[9px] font-mono text-grass-400">1.</span>}
                          {isSecond && <span className="text-[9px] font-mono text-grass-300">2.</span>}
                          {isThird && inBest8 && <span className="text-[9px] font-mono text-gold-400">★</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div className="space-y-2 max-w-lg">
              <div className="flex items-center justify-between text-[10px] font-mono text-white/25 px-1">
                <span>Gruplar: {Object.keys(groups).filter(g => groups[g]?.[0] && groups[g]?.[1]).length}/{Object.keys(GROUPS_DEF).length}</span>
                <span>En iyi 8 üçüncü: {selectedThirds.length}/8</span>
              </div>
              <button onClick={() => setStep(1)} disabled={!groupsDone}
                className="w-full py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                Devam → Bracket
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 — Bracket */}
        {step === 1 && (
          <div>
            <p className="text-xs font-mono text-white/40 mb-4">Her maçta kazananı tıkla — turlar otomatik ilerler</p>

            <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 mb-6">
              <BracketEditor
                r32Pairs={getR32Pairs()}
                state={bracketState}
                onPick={handlePick}
              />
            </div>

            {msg && (
              <p className={`text-xs font-mono text-center mb-4 ${msg.startsWith('✅') ? 'text-grass-400' : 'text-red-400'}`}>{msg}</p>
            )}

            <div className="flex flex-col gap-3 max-w-lg">
              {!userId ? (
                <Link href="/auth" className="block text-center py-3 bg-grass-500 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                  Kaydetmek için giriş yap
                </Link>
              ) : (
                <button onClick={saveBracket} disabled={!champion || saving}
                  className="py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                  {saving ? 'Kaydediliyor...' : saved ? '✅ Kaydedildi' : `💾 Bracket'imi Kaydet${champion ? ` (${gf(champion)} ${champion})` : ''}`}
                </button>
              )}
              {champion && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={shareTwitter} className="py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-white/20 hover:text-white/70 transition-colors">
                    𝕏 Twitter
                  </button>
                  <button onClick={shareWhatsapp} className="py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-grass-500/30 hover:text-grass-400 transition-colors">
                    WhatsApp
                  </button>
                </div>
              )}
              <button onClick={() => setStep(0)} className="py-2 text-white/30 font-mono text-xs hover:text-white/50 transition-colors">
                ← Grupları Düzenle
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
