import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProfileClient from '@/components/ProfileClient'

export const dynamic = 'force-dynamic'

export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const supabase = await createServerSupabase()

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('username', params.username).single()
  if (!profile) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isOwn = user?.id === profile.id

  const [
    { data: userBadges },
    { data: coupons },
    { data: followersData },
    { data: followingData },
    { data: bracketData },
  ] = await Promise.all([
    supabase.from('user_badges').select('*, badges(*)').eq('user_id', profile.id),
    supabase.from('coupons').select('*, coupon_bets(*)').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('follows').select('follower_id', { count: 'exact' }).eq('following_id', profile.id),
    supabase.from('follows').select('following_id', { count: 'exact' }).eq('follower_id', profile.id),
    supabase.from('user_brackets').select('bracket, champion, updated_at').eq('user_id', profile.id).single(),
  ])

  let isFollowing = false
  if (user && !isOwn) {
    const { data: f } = await supabase.from('follows')
      .select('follower_id').eq('follower_id', user.id).eq('following_id', profile.id).single()
    isFollowing = !!f
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
      bracket={bracketData ? { ...bracketData.bracket, champion: bracketData.champion, updated_at: bracketData.updated_at } : null}
    />
  )
}
