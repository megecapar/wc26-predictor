'use client'
import { createContext, useContext, useState, ReactNode } from 'react'
import { SelectedBet } from '@/lib/types'

interface BetslipCtx {
  bets: SelectedBet[]
  toggle: (bet: SelectedBet) => void
  remove: (key: string) => void
  clear: () => void
  isSelected: (matchId: string, marketKey: string) => boolean
  totalOdds: number
}

const Ctx = createContext<BetslipCtx | null>(null)

export function BetslipProvider({ children }: { children: ReactNode }) {
  const [bets, setBets] = useState<SelectedBet[]>([])

  const key = (b: SelectedBet) => `${b.matchId}__${b.marketKey}`

  const toggle = (bet: SelectedBet) => {
    setBets(prev => {
      const k = key(bet)
      const exists = prev.some(b => key(b) === k)
      if (exists) return prev.filter(b => key(b) !== k)
      // aynı maçtan önceki aynı market grubunu temizle (ör. ms seçimi değişince)
      const group = bet.marketKey.split('.')[0]
      const filtered = prev.filter(b => !(b.matchId === bet.matchId && b.marketKey.startsWith(group)))
      return [...filtered, bet]
    })
  }

  const remove = (k: string) => setBets(prev => prev.filter(b => key(b) !== k))
  const clear = () => setBets([])

  const isSelected = (matchId: string, marketKey: string) =>
    bets.some(b => b.matchId === matchId && b.marketKey === marketKey)

  const totalOdds = bets.reduce((acc, b) => acc * b.odd, 1)

  return (
    <Ctx.Provider value={{ bets, toggle, remove, clear, isSelected, totalOdds }}>
      {children}
    </Ctx.Provider>
  )
}

export const useBetslip = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBetslip must be inside BetslipProvider')
  return ctx
}
