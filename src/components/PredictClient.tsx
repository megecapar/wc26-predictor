'use client'
import { useState } from 'react'
import { MatchPrediction } from '@/lib/types'
import { Navbar } from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/user-context'
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

function getFlag(name: string) { return FLAGS[name] ?? '🏳️' }
function T(name: string): Team { return { name, flag: getFlag(name), elo: 0 } }

type BracketState = {
  groups: Record<string, [string, string]>  // grup → [1., 2.]
  best8thirds: string[]                      // en iyi 8 üçüncü
  r32: Record<string, string>               // "m1" → kazanan
  r16: Record<string, string>
  qf: Record<string, string>
  sf: Record<string, string>
  final: Record<string, string>
  champion: string
}

const STEPS = ['Gruplar', 'En İyi 8 Üçüncü', 'Son 32', 'Son 16', 'Çeyrek', 'Yarı', 'Final']

export default function PredictClient({ matches }: Props) {
  const { userId, username } = useUser()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState('')

  // Bracket state
  const [groups, setGroups] = useState<Record<string, [string, string]>>({})
  const [best8, setBest8] = useState<string[]>([])
  const [selectedThirds, setSelectedThirds] = useState<string[]>([])
  const [r32, setR32] = useState<Record<string, string>>({})
  const [r16, setR16] = useState<Record<string, string>>({})
  const [qf,  setQF]  = useState<Record<string, string>>({})
  const [sf,  setSF]  = useState<Record<string, string>>({})
  const [fin, setFin] = useState<Record<string, string>>({})
  const [champion, setChampion] = useState('')

  // Grup seçimi
  function selectGroupTeam(g: string, team: string) {
    const current = groups[g] ?? ['', '']
    if (current[0] === team) {
      setGroups(prev => ({ ...prev, [g]: ['', current[1]] }))
    } else if (current[1] === team) {
      setGroups(prev => ({ ...prev, [g]: [current[0], ''] }))
    } else if (!current[0]) {
      setGroups(prev => ({ ...prev, [g]: [team, current[1]] }))
    } else if (!current[1]) {
      setGroups(prev => ({ ...prev, [g]: [current[0], team] }))
    } else {
      // İkisi de dolu — ilkini değiştir
      setGroups(prev => ({ ...prev, [g]: [team, current[1]] }))
    }
  }

  // Grup adımı tamamlandı mı?
  const groupsDone = Object.keys(GROUPS_DEF).every(g => {
    const sel = groups[g]
    return sel && sel[0] && sel[1]
  })

  // R32 maç eşleşmeleri (resmi FIFA formatı)
  function getR32Pairs(): [string, string][] {
    const w = (g: string) => groups[g]?.[0] ?? '?'
    const r = (g: string) => groups[g]?.[1] ?? '?'
    const b = (i: number) => best8[i] ?? '?'
    return [
      // Sol bracket
      [r('A'), r('B')], [w('E'), b(0)], [w('F'), r('C')], [w('C'), r('F')],
      [r('E'), r('I')], [w('I'), b(1)], [w('A'), b(2)],   [w('L'), b(3)],
      // Sağ bracket
      [r('K'), r('L')], [w('H'), r('J')], [w('B'), b(4)], [r('D'), r('G')],
      [w('J'), r('H')], [w('K'), b(5)],  [w('G'), b(6)],  [w('D'), b(7)],
    ]
  }

  function getNextPairs(prev: Record<string, string>, count: number): [string, string][] {
    const winners = Object.values(prev)
    const pairs: [string, string][] = []
    for (let i = 0; i < count * 2; i += 2) {
      pairs.push([winners[i] ?? '?', winners[i+1] ?? '?'])
    }
    return pairs
  }

  // Adım geçiş
  function nextStep() {
    if (step === 0) {
      // Adım 1'e geçince 3. sıra takımları hesapla
      const thirds: string[] = []
      for (const [g, teams] of Object.entries(GROUPS_DEF)) {
        const sel = groups[g] ?? ['', '']
        const third = teams.find(t => t !== sel[0] && t !== sel[1])
        if (third) thirds.push(third)
      }
      setBest8(thirds) // 12 üçüncü takım
      setSelectedThirds([]) // seçimleri sıfırla
    }
    if (step === 1) {
      // Seçilen 8 üçüncüyü kaydet
      setBest8(selectedThirds)
    }
    setStep(s => s + 1)
  }

  // Kaydet
  async function saveBracket() {
    if (!userId) return
    setSaving(true)
    const bracket = { groups, best8, r32, r16, qf, sf, final: fin, champion }
    const { error } = await supabase.from('user_brackets').upsert({
      user_id: userId,
      bracket,
      champion,
      updated_at: new Date().toISOString(),
    })
    if (error) setMsg('❌ ' + error.message)
    else { setSaved(true); setMsg('✅ Bracket kaydedildi!') }
    setSaving(false)
  }

  // Twitter paylaşım
  function shareTwitter() {
    const text = encodeURIComponent(
      `WC 2026 Bracket Tahminim 🏆\n\nŞampiyon: ${champion ? getFlag(champion) + ' ' + champion : '?'}\n\nhttps://wc26-predictor-orcin.vercel.app/predict #FIFA2026 #WorldCup2026`
    )
    window.open(`https://twitter.com/intent/tweet?text=${text}`)
  }

  function shareWhatsapp() {
    const text = encodeURIComponent(
      `WC 2026 Bracket Tahminim 🏆\nŞampiyon: ${champion ? getFlag(champion) + ' ' + champion : '?'}\nhttps://wc26-predictor-orcin.vercel.app/predict`
    )
    window.open(`https://wa.me/?text=${text}`)
  }

  const r32pairs = step >= 2 ? getR32Pairs() : []
  const r16pairs = step >= 3 ? getNextPairs(r32, 8) : []
  const qfpairs  = step >= 4 ? getNextPairs(r16, 4) : []
  const sfpairs  = step >= 5 ? getNextPairs(qf,  2) : []
  const finpairs = step >= 6 ? getNextPairs(sf,  1) : []

  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/predict" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl text-chalk-50 tracking-wide">
            TAHMİN<br /><span className="text-grass-400">BRACKET&apos;İN</span>
          </h1>
          <p className="text-xs font-mono text-white/35 mt-2">Kendi şampiyonunu seç · Kaydet · Paylaş</p>
        </div>

        {/* Step bar */}
        <div className="flex gap-0 mb-8 rounded-lg overflow-hidden border border-white/8">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => i < step && setStep(i)}
              className={`flex-1 py-2 text-[10px] font-mono text-center transition-colors ${i === step ? 'bg-grass-500/20 text-grass-300' : i < step ? 'bg-white/5 text-white/50 hover:bg-white/8' : 'bg-white/[0.02] text-white/20'}`}>
              {i < step ? '✓ ' : ''}{s}
            </button>
          ))}
        </div>

        {/* STEP 0 — Gruplar */}
        {step === 0 && (
          <div>
            <p className="text-xs font-mono text-white/40 mb-4">Her gruptan çıkacak 2 takımı seç (1. ve 2. sıralar)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {Object.entries(GROUPS_DEF).map(([g, teams]) => {
                const sel = groups[g] ?? ['', '']
                return (
                  <div key={g} className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-white/[0.04] border-b border-white/8 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Grup {g}</span>
                      <div className="flex gap-1">
                        {sel[0] && <span className="text-[9px] font-mono text-grass-400 bg-grass-500/10 px-1.5 py-0.5 rounded">1. {getFlag(sel[0])}</span>}
                        {sel[1] && <span className="text-[9px] font-mono text-grass-300 bg-grass-500/10 px-1.5 py-0.5 rounded">2. {getFlag(sel[1])}</span>}
                      </div>
                    </div>
                    {teams.map(t => {
                      const isFirst  = sel[0] === t
                      const isSecond = sel[1] === t
                      return (
                        <button key={t} onClick={() => selectGroupTeam(g, t)}
                          className={`w-full flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 transition-colors ${isFirst ? 'bg-grass-500/15' : isSecond ? 'bg-grass-500/8' : 'hover:bg-white/5'}`}>
                          <span className="text-base">{getFlag(t)}</span>
                          <span className={`text-xs font-mono flex-1 text-left ${isFirst || isSecond ? 'text-white/90' : 'text-white/50'}`}>{t}</span>
                          {isFirst  && <span className="text-[9px] font-mono text-grass-400">1.</span>}
                          {isSecond && <span className="text-[9px] font-mono text-grass-300">2.</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <button onClick={nextStep} disabled={!groupsDone}
              className="w-full py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
              Devam → Son 32 {!groupsDone && `(${Object.keys(GROUPS_DEF).length - Object.keys(groups).filter(g => groups[g]?.[0] && groups[g]?.[1]).length} grup kaldı)`}
            </button>
          </div>
        )}

        {/* STEP 1 — En iyi 8 üçüncü seçimi */}
        {step === 1 && (
          <div>
            <p className="text-xs font-mono text-white/40 mb-1">12 gruptan üçüncü biten takımlar arasından 8 tanesini seç</p>
            <p className="text-[10px] font-mono text-white/25 mb-4">Seçilen 8 takım Son 32'ye katılır</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {best8.map(t => {
                const selected = selectedThirds.includes(t)
                return (
                  <button key={t}
                    onClick={() => {
                      if (selected) {
                        setSelectedThirds(prev => prev.filter(x => x !== t))
                      } else if (selectedThirds.length < 8) {
                        setSelectedThirds(prev => [...prev, t])
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${selected ? 'bg-gold-500/15 border-gold-500/30' : 'bg-white/[0.02] border-white/8 hover:bg-white/5'}`}>
                    <span className="text-base">{getFlag(t)}</span>
                    <span className={`text-xs font-mono flex-1 text-left ${selected ? 'text-gold-300' : 'text-white/50'}`}>{t}</span>
                    {selected && <span className="text-[10px] font-mono text-gold-400">{selectedThirds.indexOf(t) + 1}</span>}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] font-mono text-white/30 mb-4 text-center">
              {selectedThirds.length}/8 seçildi
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="px-6 py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-white/20 transition-colors">
                ← Geri
              </button>
              <button onClick={nextStep} disabled={selectedThirds.length !== 8}
                className="flex-1 py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                Devam → Son 32 {selectedThirds.length < 8 && `(${8 - selectedThirds.length} kaldı)`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2-5 — Eleme turları */}
        {step >= 2 && step <= 5 && (() => {
          const configs = [
            { label: 'Son 32', pairs: r32pairs, state: r32, setState: setR32, key: 'r32' },
            { label: 'Son 16', pairs: r16pairs, state: r16, setState: setR16, key: 'r16' },
            { label: 'Çeyrek Final', pairs: qfpairs, state: qf, setState: setQF, key: 'qf' },
            { label: 'Yarı Final', pairs: sfpairs, state: sf, setState: setSF, key: 'sf' },
          ]
          const cfg = configs[step - 2]
          const currentDone = cfg.pairs.every((_, i) => cfg.state[`m${i}`])

          return (
            <div>
              <p className="text-xs font-mono text-white/40 mb-4">{cfg.label} — Her maçta kazananı seç</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {cfg.pairs.map(([t1, t2], i) => {
                  const winner = cfg.state[`m${i}`]
                  return (
                    <div key={i} className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                      <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/5">
                        <span className="text-[9px] font-mono text-white/25">Maç {i + 1}</span>
                      </div>
                      {[t1, t2].map(t => (
                        <button key={t} onClick={() => cfg.setState(prev => ({ ...prev, [`m${i}`]: t }))}
                          disabled={t === '?'}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-white/5 last:border-0 transition-colors disabled:opacity-30 ${winner === t ? 'bg-grass-500/15' : 'hover:bg-white/5'}`}>
                          <span className="text-base">{getFlag(t)}</span>
                          <span className={`text-sm font-mono flex-1 text-left ${winner === t ? 'text-grass-300 font-medium' : 'text-white/60'}`}>{t === '?' ? 'TBD' : t}</span>
                          {winner === t && <span className="text-[10px] font-mono text-grass-400">✓</span>}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(s => s - 1)} className="px-6 py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-white/20 transition-colors">
                  ← Geri
                </button>
                <button onClick={nextStep} disabled={!currentDone}
                  className="flex-1 py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                  Devam → {STEPS[step + 1]}
                </button>
              </div>
            </div>
          )
        })()}

        {/* STEP 5 — Final & Şampiyon */}
        {step === 6 && (
          <div>
            <p className="text-xs font-mono text-white/40 mb-4">Final — Şampiyonu seç!</p>

            {finpairs.length > 0 && (
              <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden mb-6 max-w-sm mx-auto">
                <div className="px-3 py-2 bg-gold-500/10 border-b border-gold-500/20 text-center">
                  <span className="text-[10px] font-mono text-gold-300 uppercase tracking-widest">🏆 Final</span>
                </div>
                {finpairs[0].map(t => (
                  <button key={t} onClick={() => { setFin({ m0: t }); setChampion(t) }}
                    disabled={t === '?'}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors disabled:opacity-30 ${champion === t ? 'bg-gold-500/15' : 'hover:bg-white/5'}`}>
                    <span className="text-2xl">{getFlag(t)}</span>
                    <span className={`text-base font-mono flex-1 text-left ${champion === t ? 'text-gold-300 font-medium' : 'text-white/60'}`}>{t === '?' ? 'TBD' : t}</span>
                    {champion === t && <span className="text-lg">🏆</span>}
                  </button>
                ))}
              </div>
            )}

            {champion && (
              <div className="text-center mb-6">
                <p className="text-3xl mb-2">{getFlag(champion)}</p>
                <p className="font-display text-2xl text-gold-300">{champion}</p>
                <p className="text-xs font-mono text-white/35 mt-1">Senin şampiyonun</p>
              </div>
            )}

            {msg && (
              <p className={`text-xs font-mono text-center mb-4 ${msg.startsWith('✅') ? 'text-grass-400' : 'text-red-400'}`}>{msg}</p>
            )}

            <div className="flex flex-col gap-3">
              {!userId ? (
                <Link href="/auth" className="block text-center py-3 bg-grass-500 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                  Kaydetmek için giriş yap
                </Link>
              ) : (
                <button onClick={saveBracket} disabled={!champion || saving}
                  className="py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                  {saving ? 'Kaydediliyor...' : saved ? '✅ Kaydedildi' : '💾 Bracket\'imi Kaydet'}
                </button>
              )}

              {champion && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={shareTwitter}
                    className="py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-white/20 hover:text-white/70 transition-colors">
                    𝕏 Twitter
                  </button>
                  <button onClick={shareWhatsapp}
                    className="py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-grass-500/30 hover:text-grass-400 transition-colors">
                    WhatsApp
                  </button>
                </div>
              )}

              <button onClick={() => setStep(s => s - 1)} className="py-2 text-white/30 font-mono text-xs hover:text-white/50 transition-colors">
                ← Geri
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
