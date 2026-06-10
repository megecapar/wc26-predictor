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
  const [username,    setUsername]    = useState<string | null>(null)
  const [userId,      setUserId]      = useState<string | null>(null)
  const [menuOpen,    setMenuOpen]    = useState(false)
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
    <header className="border-b border-white/8 bg-black/20 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-display tracking-wider text-chalk-50 hover:text-grass-400 transition-colors">WC26</Link>
          <span className="text-[10px] font-mono text-grass-400 border border-grass-500/30 rounded px-1.5 py-0.5 bg-grass-500/10 hidden sm:block">PREDICTOR</span>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 bg-red-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="hidden sm:block">CANLI</span>
            </span>
          )}
        </div>

        {/* Masaüstü nav */}
        <div className="hidden sm:flex items-center gap-4">
          <nav className="flex gap-4 text-[11px] font-mono text-white/40">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`hover:text-white/70 transition-colors ${active === l.href ? 'text-white/80' : ''}`}>
                {l.label}
              </Link>
            ))}
            {userId ? (
              <Link href={`/profile/${username}`} className="text-grass-400 hover:text-grass-300 transition-colors">
                @{username}
              </Link>
            ) : (
              <Link href="/auth" className="hover:text-white/70 transition-colors">Giriş</Link>
            )}
          </nav>
          {lastUpdate && (
            <span className="text-[10px] font-mono text-white/15">
              {new Date(lastUpdate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Mobil hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="sm:hidden flex flex-col gap-1 p-2"
        >
          <span className={`w-5 h-0.5 bg-white/60 transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`w-5 h-0.5 bg-white/60 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-0.5 bg-white/60 transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>
      </div>

      {/* Mobil menü */}
      {menuOpen && (
        <div className="sm:hidden border-t border-white/8 bg-black/40 backdrop-blur-md px-4 py-3 space-y-1" onClick={() => setMenuOpen(false)}>
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`block py-2 text-sm font-mono transition-colors ${active === l.href ? 'text-white' : 'text-white/50 hover:text-white/80'}`}>
              {l.label}
            </Link>
          ))}
          <div className="pt-1 border-t border-white/8 mt-1">
            {userId ? (
              <Link href={`/profile/${username}`} className="block py-2 text-sm font-mono text-grass-400">
                @{username}
              </Link>
            ) : (
              <Link href="/auth" className="block py-2 text-sm font-mono text-white/50 hover:text-white/80">
                Giriş Yap / Kayıt Ol
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
