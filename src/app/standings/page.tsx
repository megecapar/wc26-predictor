import { getMatches } from '@/lib/blob'
import StandingsClient from '@/components/StandingsClient'

export const dynamic = 'force-dynamic'

export default async function StandingsPage() {
  const matches = await getMatches()
  return <StandingsClient matches={matches} />
}
