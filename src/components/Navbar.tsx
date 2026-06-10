'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export function Navbar({ active }: { active?: string }) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single()
        setUsername(profile?.username ?? null)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single()
        setUsername(profile?.username ?? null)
      } else {
        setUsername(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const links = [
    { href: '/',            label: 'Maçlar'    },
    { href: '/bracket',     label: 'Bracket'   },
    { href: '/standings',   label: 'Sıralama'  },
    { href: '/leaderboard', label: 'Liderboard'},
  ]

  return (
    <header className="border-b border-white/8 bg-black/20 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-2xl font-display tracking-wider text-chalk-50 hover:text-grass-400 transition-colors">WC26</Link>
          <span className="text-[10px] font-mono text-grass-400 border border-grass-500/30 rounded px-1.5 py-0.5 bg-grass-500/10">PREDICTOR</span>
        </div>
        <nav className="flex gap-4 text-[11px] font-mono text-white/40">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`hover:text-white/70 transition-colors ${active === l.href ? 'text-white/80' : ''}`}>
              {l.label}
            </Link>
          ))}
          {user ? (
            <Link href="/profile" className="text-grass-400 hover:text-grass-300 transition-colors">
              @{username ?? user.email?.split('@')[0]}
            </Link>
          ) : (
            <Link href="/auth" className="hover:text-white/70 transition-colors">Giriş</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
