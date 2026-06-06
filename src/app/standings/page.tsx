import { getMatches } from '@/lib/blob'
import StandingsClient from '@/components/StandingsClient'

export const revalidate = 300

export default async function StandingsPage() {
  const matches = await getMatches()
  return <StandingsClient matches={matches} />
}
