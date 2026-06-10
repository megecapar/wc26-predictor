import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProfileClient from '@/components/ProfileClient'

export const dynamic = 'force-dynamic'

export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const supabase = await createServerSupabase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwn = user?.id === profile.id

  const { data: userBadges } = await supabase
    .from('user_badges').select('*, badges(*)').eq('user_id', profile.id)

  const { data: coupons } = await supabase
    .from('coupons').select('*, coupon_bets(*)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: followersData } = await supabase
    .from('follows').select('follower_id', { count: 'exact' }).eq('following_id', profile.id)

  const { data: followingData } = await supabase
    .from('follows').select('following_id', { count: 'exact' }).eq('follower_id', profile.id)

  // Takip ediyor mu?
  let isFollowing = false
  if (user) {
    const { data: followData } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .single()
    isFollowing = !!followData
  }

  return (
    <ProfileClient
      profile={profile}
      badges={userBadges ?? []}
      coupons={coupons ?? []}
      followersCount={followersData?.length ?? 0}
      followingCount={followingData?.length ?? 0}
      isOwn={isOwn}
      isFollowing={isFollowing}
      viewerId={user?.id}
    />
  )
}
