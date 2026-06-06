import { getMatches } from '@/lib/blob'
import BracketClient from '@/components/BracketClient'

export const revalidate = 300

export default async function BracketPage() {
  const matches = await getMatches()
  return <BracketClient matches={matches} />
}
