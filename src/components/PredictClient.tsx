'use client'
import { useEffect, useState } from 'react'
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

// Sol ve sağ bracket tamamen ayrı — her birinin kendi r32/r16/qf/sf state'i var
interface SideState { r32: string[]; r16: string[]; qf: string[]; sf: string }
const emptySide = (): SideState => ({ r32: [], r16: [], qf: [], sf: '' })

function Slot({ team, win, onClick }: { team: string; win: boolean; onClick?: () => void }) {
  const tbd = !team || team === '?'
  return (
    <button onClick={onClick} disabled={tbd || !onClick}
      className={`flex items-center gap-1.5 px-2 py-1.5 w-[118px] border-x border-t last:border-b first:rounded-t last:rounded-b overflow-hidden font-mono text-[10px] transition-colors disabled:cursor-default
        ${win ? 'bg-grass-500/15 border-grass-500/35 text-grass-300 font-medium'
               : tbd ? 'bg-white/[0.02] border-white/8 text-white/20'
                     : 'bg-white/[0.02] border-white/8 text-white/55 hover:bg-white/8 cursor-pointer'}`}>
      <span className="text-sm flex-shrink-0">{tbd ? '🏳️' : gf(team)}</span>
      <span className="truncate">{tbd ? 'TBD' : team}</span>
    </button>
  )
}

function MBox({ t1, t2, winner, onPick }: { t1:string; t2:string; winner:string; onPick:(t:string)=>void }) {
  return (
    <div className="flex flex-col">
      <Slot team={t1} win={winner===t1 && !!t1 && t1!=='?'} onClick={t1&&t1!=='?'?()=>onPick(t1):undefined} />
      <Slot team={t2} win={winner===t2 && !!t2 && t2!=='?'} onClick={t2&&t2!=='?'?()=>onPick(t2):undefined} />
    </div>
  )
}

function SideCol({ label, pairs, winners, gap, onPick }: {
  label: string; pairs:[string,string][]; winners:string[]; gap:number
  onPick:(i:number,t:string)=>void
}) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
      <div className="flex flex-col">
        {pairs.map(([t1,t2],i) => (
          <div key={i} style={{marginTop: i===0?0:gap}}>
            <MBox t1={t1} t2={t2} winner={winners[i]??''} onPick={(t)=>onPick(i,t)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SideColReverse({ label, pairs, winners, gap, onPick }: {
  label: string; pairs:[string,string][]; winners:string[]; gap:number
  onPick:(i:number,t:string)=>void
}) {
  const reversed = [...pairs].reverse()
  return (
    <div className="flex flex-col flex-shrink-0">
      <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2 whitespace-nowrap">{label}</div>
      <div className="flex flex-col">
        {reversed.map(([t1,t2],ri) => {
          const orig = pairs.length-1-ri
          return (
            <div key={ri} style={{marginTop:ri===0?0:gap}}>
              <MBox t1={t1} t2={t2} winner={winners[orig]??''} onPick={(t)=>onPick(orig,t)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PredictClient({ matches: _matches }: Props) {
  const { userId } = useUser()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState('')

  const [groups, setGroups] = useState<Record<string,[string,string]>>({})
  const [selectedThirds, setSelectedThirds] = useState<string[]>([])

  // Sol ve sağ bracket tamamen ayrı state
  const [left,  setLeft]  = useState<SideState>(emptySide())
  const [right, setRight] = useState<SideState>(emptySide())
  const [champion, setChampion] = useState('')

  function selectGroupTeam(g: string, team: string) {
    const cur = groups[g] ?? ['','']
    if (cur[0]===team) { setGroups(p=>({...p,[g]:['',cur[1]]})); return }
    if (cur[1]===team) { setGroups(p=>({...p,[g]:[cur[0],'']})); return }
    if (!cur[0]) { setGroups(p=>({...p,[g]:[team,cur[1]]})); return }
    if (!cur[1]) { setGroups(p=>({...p,[g]:[cur[0],team]})); return }
    setSelectedThirds(p => p.includes(team) ? p.filter(x=>x!==team) : p.length<8 ? [...p,team] : p)
  }

  const allGroupsDone = Object.keys(GROUPS_DEF).every(g => groups[g]?.[0] && groups[g]?.[1])
  const groupsDone = allGroupsDone && selectedThirds.length===8

  function getR32(): { left:[string,string][]; right:[string,string][] } {
    const w = (g:string) => groups[g]?.[0]??'?'
    const r = (g:string) => groups[g]?.[1]??'?'
    const b = (i:number) => selectedThirds[i]??'?'
    return {
      left:  [[r('A'),r('B')],[w('E'),b(0)],[w('F'),r('C')],[w('C'),r('F')],[r('E'),r('I')],[w('I'),b(1)],[w('A'),b(2)],[w('L'),b(3)]],
      right: [[r('K'),r('L')],[w('H'),r('J')],[w('B'),b(4)],[r('D'),r('G')],[w('J'),r('H')],[w('K'),b(5)],[w('G'),b(6)],[w('D'),b(7)]],
    }
  }

  // Sol pick handler
  function pickLeft(round: 'r32'|'r16'|'qf'|'sf', idx: number, team: string) {
    setLeft(prev => {
      const next = {...prev}
      if (round==='r32') { const a=[...prev.r32]; a[idx]=team; next.r32=a }
      if (round==='r16') { const a=[...prev.r16]; a[idx]=team; next.r16=a }
      if (round==='qf')  { const a=[...prev.qf];  a[idx]=team; next.qf=a  }
      if (round==='sf')  { next.sf=team }
      return next
    })
  }

  // Sağ pick handler
  function pickRight(round: 'r32'|'r16'|'qf'|'sf', idx: number, team: string) {
    setRight(prev => {
      const next = {...prev}
      if (round==='r32') { const a=[...prev.r32]; a[idx]=team; next.r32=a }
      if (round==='r16') { const a=[...prev.r16]; a[idx]=team; next.r16=a }
      if (round==='qf')  { const a=[...prev.qf];  a[idx]=team; next.qf=a  }
      if (round==='sf')  { next.sf=team }
      return next
    })
  }

  const { left: lR32, right: rR32 } = step===1 ? getR32() : { left:[], right:[] }

  // Sol tur hesapla
  const lR16pairs:  [string,string][] = [[left.r32[0]??'?',left.r32[1]??'?'],[left.r32[2]??'?',left.r32[3]??'?'],[left.r32[4]??'?',left.r32[5]??'?'],[left.r32[6]??'?',left.r32[7]??'?']]
  const lQFpairs:   [string,string][] = [[left.r16[0]??'?',left.r16[1]??'?'],[left.r16[2]??'?',left.r16[3]??'?']]
  const lSFpair:    [string,string]   =  [left.qf[0]??'?', left.qf[1]??'?']

  // Sağ tur hesapla
  const rR16pairs:  [string,string][] = [[right.r32[0]??'?',right.r32[1]??'?'],[right.r32[2]??'?',right.r32[3]??'?'],[right.r32[4]??'?',right.r32[5]??'?'],[right.r32[6]??'?',right.r32[7]??'?']]
  const rQFpairs:   [string,string][] = [[right.r16[0]??'?',right.r16[1]??'?'],[right.r16[2]??'?',right.r16[3]??'?']]
  const rSFpair:    [string,string]   =  [right.qf[0]??'?', right.qf[1]??'?']

  async function saveBracket() {
    if (!userId||!champion) return
    setSaving(true)
    const bracket = { groups, selectedThirds, left, right, champion }
    const { error } = await supabase.from('user_brackets').upsert(
      { user_id:userId, bracket, champion, updated_at:new Date().toISOString() },
      { onConflict:'user_id' }
    )
    if (error) setMsg('❌ '+error.message)
    else { setSaved(true); setMsg('✅ Bracket kaydedildi!') }
    setSaving(false)
  }
  // Sayfa yüklenince localStorage'dan oku
  useEffect(() => {
  try {
    const saved = localStorage.getItem('wc26_bracket_draft')
    if (saved) {
      const d = JSON.parse(saved)
      if (d.groups) setGroups(d.groups)
      if (d.selectedThirds) setSelectedThirds(d.selectedThirds)
      if (d.left) setLeft(d.left)
      if (d.right) setRight(d.right)
      if (d.champion) setChampion(d.champion)
      if (d.step) setStep(d.step)
    }
  } catch {}
}, [])
useEffect(() => {
  try {
    localStorage.setItem('wc26_bracket_draft', JSON.stringify({
      groups, selectedThirds, left, right, champion, step
    }))
  } catch {}
}, [groups, selectedThirds, left, right, champion, step])

  function shareTwitter() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`WC 2026 Bracket Tahminim 🏆\nŞampiyon: ${gf(champion)} ${champion}\nhttps://wc26-predictor-orcin.vercel.app/predict #FIFA2026`)}`)
  }
  function shareWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`WC 2026 Bracket Tahminim 🏆\nŞampiyon: ${gf(champion)} ${champion}\nhttps://wc26-predictor-orcin.vercel.app/predict`)}`)
  }
  
  

  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/predict" />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-4xl sm:text-5xl text-chalk-50 tracking-wide">TAHMİN<br /><span className="text-grass-400">BRACKET&apos;İN</span></h1>
          <p className="text-xs font-mono text-white/35 mt-2">Grupları seç · Bracket&apos;te ilerle · Kaydet</p>
        </div>

        <div className="flex gap-0 mb-8 rounded-lg overflow-hidden border border-white/8 w-fit">
          {['Gruplar','Bracket'].map((s,i) => (
            <button key={i} onClick={()=>i<step?setStep(i):undefined}
              className={`px-6 py-2 text-xs font-mono transition-colors ${i===step?'bg-grass-500/20 text-grass-300':i<step?'bg-white/5 text-white/50 hover:bg-white/8 cursor-pointer':'bg-white/[0.02] text-white/20'}`}>
              {i<step?'✓ ':''}{s}
            </button>
          ))}
        </div>

        {/* STEP 0 — Gruplar */}
        {step===0 && (
          <div>
            <p className="text-xs font-mono text-white/40 mb-1">1. tıklama → 1. sıra · 2. tıklama → 2. sıra · 3. takıma tıklama → en iyi 8 üçüncü ★</p>
            <p className="text-[10px] font-mono text-white/25 mb-4">En iyi 8 üçüncü: {selectedThirds.length}/8 seçildi</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
              {Object.entries(GROUPS_DEF).map(([g,teams]) => {
                const sel = groups[g]??['','']
                return (
                  <div key={g} className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-white/[0.04] border-b border-white/8 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">Grup {g}</span>
                      <div className="flex gap-1">
                        {sel[0]&&<span className="text-[9px] font-mono text-grass-400 bg-grass-500/10 px-1.5 py-0.5 rounded">1. {gf(sel[0])}</span>}
                        {sel[1]&&<span className="text-[9px] font-mono text-grass-300 bg-grass-500/10 px-1.5 py-0.5 rounded">2. {gf(sel[1])}</span>}
                      </div>
                    </div>
                    {teams.map(t => {
                      const isFirst=sel[0]===t, isSecond=sel[1]===t
                      const inBest8=selectedThirds.includes(t)
                      return (
                        <button key={t} onClick={()=>selectGroupTeam(g,t)}
                          className={`w-full flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 transition-colors ${isFirst?'bg-grass-500/15':isSecond?'bg-grass-500/8':inBest8?'bg-gold-500/10':'hover:bg-white/5'}`}>
                          <span className="text-base">{gf(t)}</span>
                          <span className={`text-xs font-mono flex-1 text-left ${isFirst||isSecond?'text-white/90':inBest8?'text-gold-300':'text-white/50'}`}>{t}</span>
                          {isFirst  && <span className="text-[9px] font-mono text-grass-400">1.</span>}
                          {isSecond && <span className="text-[9px] font-mono text-grass-300">2.</span>}
                          {!isFirst&&!isSecond&&inBest8 && <span className="text-[9px] font-mono text-gold-400">★</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div className="space-y-2 max-w-lg">
              <div className="flex items-center justify-between text-[10px] font-mono text-white/25 px-1">
                <span>Gruplar: {Object.keys(groups).filter(g=>groups[g]?.[0]&&groups[g]?.[1]).length}/{Object.keys(GROUPS_DEF).length}</span>
                <span>En iyi 8 üçüncü: {selectedThirds.length}/8</span>
              </div>
              <button onClick={()=>setStep(1)} disabled={!groupsDone}
                className="w-full py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                Devam → Bracket
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 — Bracket */}
        {step===1 && (
          <div>
            <p className="text-xs font-mono text-white/40 mb-4">Her maçta kazananı tıkla — turlar otomatik ilerler</p>
            <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 mb-6">
              <div className="overflow-x-auto pb-2">
                <div className="flex items-start justify-center gap-0 min-w-max py-1">

                  {/* ── SOL BRACKET ── */}
                  <SideCol label="R32" pairs={lR32} winners={left.r32} gap={3}
                    onPick={(i,t)=>pickLeft('r32',i,t)} />
                  <div className="w-2 flex-shrink-0" />
                  <SideCol label="R16" pairs={lR16pairs} winners={left.r16} gap={55}
                    onPick={(i,t)=>pickLeft('r16',i,t)} />
                  <div className="w-2 flex-shrink-0" />
                  <SideCol label="QF" pairs={lQFpairs} winners={left.qf} gap={167}
                    onPick={(i,t)=>pickLeft('qf',i,t)} />
                  <div className="w-2 flex-shrink-0" />

                  {/* Sol SF */}
                  <div className="flex flex-col flex-shrink-0">
                    <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">SF</div>
                    <MBox t1={lSFpair[0]} t2={lSFpair[1]} winner={left.sf} onPick={(t)=>pickLeft('sf',0,t)} />
                  </div>
                  <div className="w-2 flex-shrink-0" />

                  {/* FINAL */}
                  <div className="flex flex-col flex-shrink-0 items-center">
                    <div className="text-[9px] font-mono text-white/25 uppercase tracking-widest text-center px-2 py-1.5 bg-white/[0.03] border border-white/8 rounded mb-2">Final</div>
                    <div style={{marginTop:44}}>
                      <MBox t1={left.sf??'?'} t2={right.sf??'?'} winner={champion} onPick={(t)=>setChampion(t)} />
                    </div>
                    {champion && champion!=='?' && (
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
                    <MBox t1={rSFpair[0]} t2={rSFpair[1]} winner={right.sf} onPick={(t)=>pickRight('sf',0,t)} />
                  </div>
                  <div className="w-2 flex-shrink-0" />

                  {/* ── SAĞ BRACKET ── */}
                  <SideColReverse label="QF" pairs={rQFpairs} winners={right.qf} gap={167}
                    onPick={(i,t)=>pickRight('qf',i,t)} />
                  <div className="w-2 flex-shrink-0" />
                  <SideColReverse label="R16" pairs={rR16pairs} winners={right.r16} gap={55}
                    onPick={(i,t)=>pickRight('r16',i,t)} />
                  <div className="w-2 flex-shrink-0" />
                  <SideColReverse label="R32" pairs={rR32} winners={right.r32} gap={3}
                    onPick={(i,t)=>pickRight('r32',i,t)} />

                </div>
              </div>
            </div>

            {msg && <p className={`text-xs font-mono text-center mb-4 ${msg.startsWith('✅')?'text-grass-400':'text-red-400'}`}>{msg}</p>}

            <div className="flex flex-col gap-3 max-w-lg">
              {!userId ? (
                <Link href="/auth" className="block text-center py-3 bg-grass-500 text-white font-mono text-sm rounded-xl">Kaydetmek için giriş yap</Link>
              ) : (
                <button onClick={saveBracket} disabled={!champion||saving}
                  className="py-3 bg-grass-500 disabled:opacity-30 text-white font-mono text-sm rounded-xl hover:bg-grass-400 transition-colors">
                  {saving?'Kaydediliyor...':saved?'✅ Kaydedildi':`💾 Bracket'imi Kaydet${champion?` (${gf(champion)} ${champion})`:''}`}
                </button>
              )}
              {champion && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={shareTwitter} className="py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-white/20 hover:text-white/70 transition-colors">𝕏 Twitter</button>
                  <button onClick={shareWhatsapp} className="py-3 border border-white/10 text-white/50 font-mono text-sm rounded-xl hover:border-grass-500/30 hover:text-grass-400 transition-colors">WhatsApp</button>
                </div>
              )}
              <button onClick={()=>setStep(0)} className="py-2 text-white/30 font-mono text-xs hover:text-white/50 transition-colors">← Grupları Düzenle</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
  
}
