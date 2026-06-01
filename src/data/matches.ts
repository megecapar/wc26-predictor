import { MatchPrediction } from '@/lib/types'

// matches_real.json her zaman olmalı.
// Yoksa: python scripts/fetch_and_process.py çalıştır
// eslint-disable-next-line @typescript-eslint/no-var-requires
const data = require('./matches_real.json') as MatchPrediction[]

export const MATCHES: MatchPrediction[] = data
export const GROUPS = [...new Set(data.map((m: MatchPrediction) => m.group))].sort()
