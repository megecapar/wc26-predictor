import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from '@/components/ProfileClient'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: userBadges } = await supabase
    .from('user_badges')
    .select('*, badges(*)')
    .eq('user_id', user.id)

  const { data: coupons } = await supabase
    .from('coupons')
    .select('*, coupon_bets(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: followersCount } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact' })
    .eq('following_id', user.id)

  const { data: followingCount } = await supabase
    .from('follows')
    .select('following_id', { count: 'exact' })
    .eq('follower_id', user.id)

  return (
    <ProfileClient
      profile={profile}
      badges={userBadges ?? []}
      coupons={coupons ?? []}
      followersCount={followersCount?.length ?? 0}
      followingCount={followingCount?.length ?? 0}
    />
  )
}
