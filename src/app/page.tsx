import { getMatches, getLastUpdate } from '@/lib/blob'
import HomeClient from '@/components/HomeClient'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [matches, lastUpdate] = await Promise.all([
    getMatches(),
    getLastUpdate(),
  ])
  return <HomeClient matches={matches} lastUpdate={lastUpdate} />
}
