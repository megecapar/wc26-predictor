import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('profiles').select('username').eq('id', user.id).single()

  // username'e yönlendir
  redirect(`/profile/${profile?.username ?? user.id}`)
}
