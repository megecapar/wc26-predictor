export type MatchResult = 'win' | 'draw' | 'loss'

export interface Team {
  code: string
  name: string
  flag: string
  elo: number
  fifaRank: number
  marketValue: number
  form: MatchResult[]
  group: string
}

export interface MarketOdds {
  label: string
  value: number
  probability: number
}

export interface MatchPrediction {
  id: string
  date: string
  kickoff: string
  stage: string
  group: string
  confidence: 'high' | 'mid' | 'low'
  home: Team
  away: Team
  venue?: string
  result?: { homeScore: number; awayScore: number; status: string }

  ms: {
    home: MarketOdds
    draw: MarketOdds
    away: MarketOdds
  }

  overUnder: {
    line: number
    expectedGoals: number
    over: MarketOdds
    under: MarketOdds
  }

  btts: {
    yes: MarketOdds
    no: MarketOdds
  }

  htMs: {
    home: MarketOdds
    draw: MarketOdds
    away: MarketOdds
  }
}

export interface SelectedBet {
  matchId: string
  marketKey: string
  label: string
  odd: number
}
