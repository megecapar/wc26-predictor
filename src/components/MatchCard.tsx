'use client'
import { MatchPrediction } from '@/lib/types'
import { useBetslip } from '@/lib/betslip-context'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Flame, Clock, TrendingUp, Star } from 'lucide-react'

function FormDot({ result }: { result: 'win' | 'draw' | 'loss' }) {
  return (
    <span className={cn(
      'w-2 h-2 rounded-full',
      result === 'win'  && 'bg-grass-400',
      result === 'draw' && 'bg-gold-400',
      result === 'loss' && 'bg-red-500',
    )} />
  )
}

function OddCell({
  label, odd, probability, marketKey, matchId, colorClass,
}: {
  label: string; odd: number; probability: number
  marketKey: string; matchId: string; colorClass: string
}) {
  const { toggle, isSelected } = useBetslip()
  const selected = isSelected(matchId, marketKey)
  return (
    <button
      onClick={() => toggle({ matchId, marketKey, label, odd })}
      className={cn(
        'bet-cell flex flex-col items-center justify-center gap-0.5 py-3 px-2 border border-white/5 rounded-md transition-all',
        selected ? colorClass : 'hover:border-white/15 hover:bg-white/5',
      )}
    >
      <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">{label}</span>
      <span className={cn('text-lg font-mono font-medium tabular transition-colors', selected ? 'text-white' : 'text-chalk-100')}>
        {odd.toFixed(2)}
      </span>
      <span className="text-[10px] text-white/35 font-mono">%{Math.round(probability * 100)}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">{children}</span>
    </div>
  )
}

// En iyi tek öneriyi hesapla
function getBestPick(match: MatchPrediction) {
  const options = [
    { label: `${match.home.name} kazanır`, odd: match.ms.home.value, prob: match.ms.home.probability, marketKey: 'ms.home' },
    { label: 'Beraberlik',                 odd: match.ms.draw.value, prob: match.ms.draw.probability, marketKey: 'ms.draw' },
    { label: `${match.away.name} kazanır`, odd: match.ms.away.value, prob: match.ms.away.probability, marketKey: 'ms.away' },
    { label: '2.5 Üst',                   odd: match.overUnder.over.value,  prob: match.overUnder.over.probability,  marketKey: 'ou.over'  },
    { label: '2.5 Alt',                   odd: match.overUnder.under.value, prob: match.overUnder.under.probability, marketKey: 'ou.under' },
    { label: 'KG Var',                    odd: match.btts.yes.value, prob: match.btts.yes.probability, marketKey: 'btts.yes' },
    { label: 'KG Yok',                    odd: match.btts.no.value,  prob: match.btts.no.probability,  marketKey: 'btts.no'  },
  ]
  // value = prob * odd, sadece prob>%50 ve oran>1.30 olanlar
  const valid = options.filter(o => o.prob > 0.50 && o.odd > 1.30)
  if (!valid.length) return null
  return valid.sort((a, b) => (b.prob * b.odd) - (a.prob * a.odd))[0]
}

export function MatchCard({ match }: { match: MatchPrediction }) {
  const { toggle, isSelected } = useBetslip()

  const confidenceConfig = {
    high: { label: 'Yüksek güven', variant: 'success' as const, icon: <Flame size={10} /> },
    mid:  { label: 'Orta güven',   variant: 'warning' as const, icon: null },
    low:  { label: 'Düşük güven',  variant: 'danger'  as const, icon: null },
  }
  const conf = confidenceConfig[match.confidence]
  const pick = getBestPick(match)
  const pickSelected = pick ? isSelected(match.id, pick.marketKey) : false

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden backdrop-blur-sm">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/8">
        <div className="flex items-center gap-1.5 text-white/40 text-xs font-mono">
          <Clock size={11} />
          {match.kickoff}
          {match.venue && <span className="text-white/20 hidden sm:inline">· {match.venue}</span>}
        </div>
        <Badge variant={conf.variant} className="flex items-center gap-1 text-[10px]">
          {conf.icon}{conf.label}
        </Badge>
        <span className="text-[10px] text-white/30 font-mono">{match.stage}</span>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-5">
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl leading-none">{match.home.flag}</span>
          <span className="text-sm font-medium text-chalk-100 text-center">{match.home.name}</span>
          <div className="flex gap-0.5">{match.home.form.map((r, i) => <FormDot key={i} result={r} />)}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-mono text-white/20 tracking-widest uppercase">vs</span>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp size={10} className="text-white/25" />
            <span className="text-[10px] font-mono text-white/30">{match.overUnder.expectedGoals.toFixed(1)} gol</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl leading-none">{match.away.flag}</span>
          <span className="text-sm font-medium text-chalk-100 text-center">{match.away.name}</span>
          <div className="flex gap-0.5">{match.away.form.map((r, i) => <FormDot key={i} result={r} />)}</div>
        </div>
      </div>

      {/* Favori Öneri */}
      {pick && (
        <>
          <Separator className="opacity-50" />
          <div className="px-3 py-2.5">
            <button
              onClick={() => toggle({
                matchId: match.id,
                marketKey: pick.marketKey,
                label: `${match.home.name} - ${match.away.name} · ${pick.label}`,
                odd: pick.odd,
              })}
              className={cn(
                'w-full flex items-center justify-between rounded-lg px-3.5 py-2.5 border transition-all',
                pickSelected
                  ? 'bg-gold-400/15 border-gold-400/50'
                  : 'bg-white/[0.03] border-white/8 hover:border-gold-500/30 hover:bg-gold-500/5'
              )}
            >
              <div className="flex items-center gap-2">
                <Star size={12} className={pickSelected ? 'text-gold-400' : 'text-white/30'} />
                <div className="text-left">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/35">Favori tahmin</p>
                  <p className="text-sm font-medium text-chalk-100 mt-0.5">{pick.label}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-xl font-mono font-medium tabular', pickSelected ? 'text-gold-300' : 'text-chalk-100')}>
                  {pick.odd.toFixed(2)}
                </p>
                <p className="text-[10px] font-mono text-white/30">%{Math.round(pick.prob * 100)} ihtimal</p>
              </div>
            </button>
          </div>
        </>
      )}

      <Separator className="opacity-50" />

      {/* MS */}
      <SectionLabel>Maç Sonucu</SectionLabel>
      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        <OddCell label="MS 1" odd={match.ms.home.value} probability={match.ms.home.probability} marketKey="ms.home" matchId={match.id} colorClass="border-grass-500/40 bg-grass-500/15" />
        <OddCell label="MS X" odd={match.ms.draw.value} probability={match.ms.draw.probability} marketKey="ms.draw" matchId={match.id} colorClass="border-gold-500/40 bg-gold-500/15" />
        <OddCell label="MS 2" odd={match.ms.away.value} probability={match.ms.away.probability} marketKey="ms.away" matchId={match.id} colorClass="border-blue-500/40 bg-blue-500/15" />
      </div>

      <Separator className="opacity-50" />

      {/* 2.5 */}
      <SectionLabel>2.5 Üst / Alt</SectionLabel>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <OddCell label="2.5 Üst" odd={match.overUnder.over.value}  probability={match.overUnder.over.probability}  marketKey="ou.over"  matchId={match.id} colorClass="border-grass-500/40 bg-grass-500/15" />
        <OddCell label="2.5 Alt" odd={match.overUnder.under.value} probability={match.overUnder.under.probability} marketKey="ou.under" matchId={match.id} colorClass="border-red-500/40 bg-red-500/15" />
      </div>

      <Separator className="opacity-50" />

      {/* KG + İY */}
      <SectionLabel>KG Var / Yok · İlk Yarı</SectionLabel>
      <div className="grid grid-cols-4 gap-2 px-3 pb-3">
        <OddCell label="KG Var" odd={match.btts.yes.value} probability={match.btts.yes.probability} marketKey="btts.yes" matchId={match.id} colorClass="border-grass-500/40 bg-grass-500/15" />
        <OddCell label="KG Yok" odd={match.btts.no.value}  probability={match.btts.no.probability}  marketKey="btts.no"  matchId={match.id} colorClass="border-red-500/40 bg-red-500/15" />
        <OddCell label="İY 1"   odd={match.htMs.home.value} probability={match.htMs.home.probability} marketKey="ht.home" matchId={match.id} colorClass="border-gold-500/40 bg-gold-500/15" />
        <OddCell label="İY X"   odd={match.htMs.draw.value} probability={match.htMs.draw.probability} marketKey="ht.draw" matchId={match.id} colorClass="border-gold-500/40 bg-gold-500/15" />
      </div>
    </div>
  )
}
