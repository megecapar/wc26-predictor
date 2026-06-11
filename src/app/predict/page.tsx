import { getMatches } from '@/lib/blob'
import PredictClient from '@/components/PredictClient'

export const dynamic = 'force-dynamic'

export default async function PredictPage() {
  const matches = await getMatches()
  return <PredictClient matches={matches} />
}
