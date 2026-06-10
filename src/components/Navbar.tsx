'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface NavbarProps {
  active?: string
  isLive?: boolean
  lastUpdate?: string | null
}

export function Navbar({ active, isLive, lastUpdate }: NavbarProps) {
  const [username, setUsername] = useState<string | null>(null)
  const [userId,   setUserId]   = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('username').eq('id', user.id).single()
      setUsername(profile?.username ?? user.email?.split('@')[0] ?? null)
    }
    loadUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!session?.user) { setUserId(null); setUsername(null); return }
      setUserId(session.user.id)
      const { data: profile } = await supabase
        .from('profiles').select('username').eq('id', session.user.id).single()
      setUsername(profile?.username ?? session.user.email?.split('@')[0] ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const links = [
    { href: '/',            label: 'Maçlar'     },
    { href: '/bracket',     label: 'Bracket'    },
    { href: '/standings',   label: 'Sıralama'   },
    { href: '/leaderboard', label: 'Liderboard' },
  ]

  return (
    <header className="border-b border-white/8 bg-black/20 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-2xl font-display tracking-wider text-chalk-50 hover:text-grass-400 transition-colors">WC26</Link>
          <span className="text-[10px] font-mono text-grass-400 border border-grass-500/30 rounded px-1.5 py-0.5 bg-grass-500/10">PREDICTOR</span>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 bg-red-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              CANLI
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <nav className="flex gap-4 text-[11px] font-mono text-white/40">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`hover:text-white/70 transition-colors ${active === l.href ? 'text-white/80' : ''}`}>
                {l.label}
              </Link>
            ))}
            {userId ? (
              <Link href="/profile" className="text-grass-400 hover:text-grass-300 transition-colors">
                @{username}
              </Link>
            ) : (
              <Link href="/auth" className="hover:text-white/70 transition-colors">Giriş</Link>
            )}
          </nav>
          {lastUpdate && (
            <span className="text-[10px] font-mono text-white/20 hidden sm:block">
              {new Date(lastUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
