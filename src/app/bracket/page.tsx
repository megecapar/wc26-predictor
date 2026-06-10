import { getMatches } from '@/lib/blob'
import BracketClient from '@/components/BracketClient'

export const dynamic = 'force-dynamic'

export default async function BracketPage() {
  const matches = await getMatches()
  return <BracketClient matches={matches} />
}
