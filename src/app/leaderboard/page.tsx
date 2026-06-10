import { createServerSupabase } from '@/lib/supabase/server'
import LeaderboardClient from '@/components/LeaderboardClient'

export const revalidate = 60

export default async function LeaderboardPage() {
  const supabase = await createServerSupabase()

  const { data: topUsers } = await supabase
    .from('profiles')
    .select(`
      id, username, avatar_url, points,
      coupons(count)
    `)
    .order('points', { ascending: false })
    .limit(50)

  const { data: { user } } = await supabase.auth.getUser()

  return <LeaderboardClient topUsers={topUsers ?? []} currentUserId={user?.id} />
}
