export type MatchResult = 'win' | 'draw' | 'loss'

export interface Team {
  code: string       // 'FRA'
  name: string       // 'Fransa'
  flag: string       // emoji
  elo: number
  fifaRank: number
  marketValue: number // milyon €
  form: MatchResult[] // son 5 maç
  group: string
}

export interface MarketOdds {
  label: string
  value: number      // oran, ör. 1.72
  probability: number // 0-1
}

export interface MatchPrediction {
  id: string
  date: string       // ISO
  kickoff: string    // '21:00'
  stage: string      // 'Grup A · 1. hafta'
  group: string      // 'A'
  confidence: 'high' | 'mid' | 'low'
  home: Team
  away: Team

  // MS 1 / X / 2
  ms: {
    home: MarketOdds
    draw: MarketOdds
    away: MarketOdds
  }

  // Üst / Alt
  overUnder: {
    line: number          // 2.5
    expectedGoals: number // modelin beklenen gol sayısı
    over: MarketOdds
    under: MarketOdds
  }

  // KG
  btts: {
    yes: MarketOdds
    no: MarketOdds
  }

  // İlk yarı MS
  htMs: {
    home: MarketOdds
    draw: MarketOdds
    away: MarketOdds
  }
}

export interface SelectedBet {
  matchId: string
  marketKey: string  // 'ms.home' | 'ou.over' | 'btts.yes' | 'ht.draw' ...
  label: string
  odd: number
}
