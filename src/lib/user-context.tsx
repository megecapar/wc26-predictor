'use client'
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserCtx {
  userId: string | null
  username: string | null
  loading: boolean
  refresh: () => void
}

const UserContext = createContext<UserCtx>({ userId: null, username: null, loading: true, refresh: () => {} })

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId,   setUserId]   = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUserId(null); setUsername(null); setLoading(false); return }
    setUserId(user.id)
    const { data: profile } = await supabase
      .from('profiles').select('username').eq('id', user.id).single()
    setUsername(profile?.username ?? user.email?.split('@')[0] ?? null)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [load, supabase])

  return (
    <UserContext.Provider value={{ userId, username, loading, refresh: load }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
