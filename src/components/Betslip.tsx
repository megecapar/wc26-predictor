'use client'
import { useBetslip } from '@/lib/betslip-context'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { X, Trash2, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Betslip() {
  const { bets, remove, clear, totalOdds } = useBetslip()

  return (
    <div className="flex flex-col h-full rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <ReceiptText size={14} className="text-grass-400" />
          <span className="text-sm font-mono font-medium text-chalk-100">Kupon</span>
          {bets.length > 0 && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-grass-500 text-[9px] font-mono text-white">
              {bets.length}
            </span>
          )}
        </div>
        {bets.length > 0 && (
          <button onClick={clear} className="text-white/30 hover:text-white/60 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {bets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <span className="text-3xl opacity-20">🎯</span>
          <p className="text-xs text-white/30 font-mono">Maç kartlarından oran seçin</p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 px-3 py-2">
            <div className="flex flex-col gap-1.5">
              {bets.map((bet) => (
                <div
                  key={`${bet.matchId}__${bet.marketKey}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/8 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/40 font-mono truncate">{bet.label}</p>
                    <p className="text-sm font-mono font-medium text-grass-300 tabular">
                      {bet.odd.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(`${bet.matchId}__${bet.marketKey}`)}
                    className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Separator className="opacity-50" />

          {/* Total + CTA */}
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40 font-mono">Toplam oran</span>
              <span className="text-lg font-mono font-medium text-gold-300 tabular">
                {totalOdds.toFixed(2)}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-white/30">
                <span>100 ₺ için</span>
                <span className="text-chalk-200">{(100 * totalOdds).toFixed(0)} ₺</span>
              </div>
            </div>

            <Button variant="pitch" className="w-full text-xs tracking-widest uppercase font-mono">
              Kuponu Kaydet
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
