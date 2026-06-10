'use client'
import { useState } from 'react'
import { Profile, UserBadge, Coupon } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'

interface Props {
  profile: Profile | null
  badges: UserBadge[]
  coupons: Coupon[]
  followersCount: number
  followingCount: number
  isOwn?: boolean
  isFollowing?: boolean
  viewerId?: string
}

export default function ProfileClient({
  profile, badges, coupons,
  followersCount, followingCount,
  isOwn = true, isFollowing: initFollowing = false, viewerId
}: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const [following,   setFollowing]   = useState(initFollowing)
  const [followerCnt, setFollowerCnt] = useState(followersCount)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function toggleFollow() {
    if (!viewerId || !profile) return
    if (following) {
      await supabase.from('follows')
        .delete().eq('follower_id', viewerId).eq('following_id', profile.id)
      setFollowing(false); setFollowerCnt(c => c - 1)
    } else {
      await supabase.from('follows')
        .insert({ follower_id: viewerId, following_id: profile.id })
      setFollowing(true); setFollowerCnt(c => c + 1)
      // +2 puan takip edilene
      await supabase.rpc('increment_points', { user_id: profile.id, amount: 2 }).maybeSingle()
    }
  }

  const wonCoupons = coupons.filter(c => c.status === 'won').length

  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/profile" />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profil kartı */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-grass-500/20 border border-grass-500/30 flex items-center justify-center text-2xl flex-shrink-0">
              👤
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium text-chalk-100">@{profile?.username}</h1>
              <p className="text-xs font-mono text-white/35 mt-0.5">
                {new Date(profile?.created_at ?? '').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} tarihinden beri üye
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isOwn ? (
                <button onClick={signOut}
                  className="text-[11px] font-mono text-white/40 border border-white/10 rounded-lg px-3 py-1.5 hover:text-red-400 hover:border-red-500/30 transition-colors">
                  Çıkış
                </button>
              ) : viewerId ? (
                <button onClick={toggleFollow}
                  className={`text-[11px] font-mono rounded-lg px-3 py-1.5 transition-colors ${following ? 'bg-white/5 border border-white/10 text-white/50 hover:text-red-400' : 'bg-grass-500 text-white hover:bg-grass-400'}`}>
                  {following ? 'Takibi Bırak' : '+ Takip Et'}
                </button>
              ) : (
                <Link href="/auth" className="text-[11px] font-mono bg-grass-500 text-white rounded-lg px-3 py-1.5 hover:bg-grass-400 transition-colors">
                  Takip Et
                </Link>
              )}
              <div className="text-right">
                <p className="text-2xl font-mono font-medium text-gold-300">{profile?.points ?? 0}</p>
                <p className="text-[10px] font-mono text-white/35">puan</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Kupon',    value: coupons.length },
              { label: 'Kazanan', value: wonCoupons      },
              { label: 'Takipçi', value: followerCnt     },
              { label: 'Takip',   value: followingCount  },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-white/[0.03] rounded-lg border border-white/5">
                <p className="text-xl font-mono font-medium text-chalk-100">{s.value}</p>
                <p className="text-[10px] font-mono text-white/35 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rozetler */}
        {badges.length > 0 && (
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
            <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">Rozetler</h2>
            <div className="flex flex-wrap gap-2">
              {badges.map(ub => (
                <div key={ub.badge_id} className="flex items-center gap-2 px-3 py-2 bg-gold-500/10 border border-gold-500/20 rounded-lg">
                  <span className="text-lg">{ub.badges?.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-gold-300">{ub.badges?.name}</p>
                    <p className="text-[10px] font-mono text-white/30">{ub.badges?.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kuponlar */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest">
              {isOwn ? 'Son Kuponlarım' : `@${profile?.username} Kuponları`}
            </h2>
            {isOwn && (
              <Link href="/" className="text-[10px] font-mono text-grass-400 hover:text-grass-300">
                + Yeni kupon oluştur
              </Link>
            )}
          </div>
          {coupons.length === 0 ? (
            <p className="text-xs font-mono text-white/25 text-center py-6">Henüz kupon yok</p>
          ) : (
            <div className="space-y-3">
              {coupons.map(c => (
                <div key={c.id} className="bg-white/[0.02] rounded-lg border border-white/5 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                    <div>
                      <p className="text-xs font-mono text-white/70">{c.title || `${c.coupon_bets?.length ?? 0} maçlık kupon`}</p>
                      <p className="text-[10px] font-mono text-white/30 mt-0.5">
                        {new Date(c.created_at).toLocaleDateString('tr-TR')} · Oran: <span className="text-gold-300">{c.total_odd}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.points_won > 0 && <span className="text-[10px] font-mono text-gold-400">+{c.points_won}p</span>}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        c.status === 'won'  ? 'bg-grass-500/20 text-grass-300' :
                        c.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {c.status === 'won' ? '✅ Kazandı' : c.status === 'lost' ? '❌ Kaybetti' : '⏳ Bekliyor'}
                      </span>
                    </div>
                  </div>
                  {c.coupon_bets && c.coupon_bets.length > 0 && (
                    <div className="divide-y divide-white/5">
                      {c.coupon_bets.map(b => (
                        <div key={b.id} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              b.result === 'won' ? 'bg-grass-400' : b.result === 'lost' ? 'bg-red-400' : 'bg-white/20'
                            }`} />
                            <p className="text-[10px] font-mono text-white/50 truncate">{b.match_label}</p>
                            <span className="text-[10px] font-mono text-white/25 flex-shrink-0">{b.market_label}</span>
                          </div>
                          <span className="text-[10px] font-mono text-grass-300 ml-2 flex-shrink-0">{b.odd}</span>
                        </div>
                      ))}
                      {/* Paylaş butonları */}
                      <div className="flex gap-2 px-3 py-2">
                        <button
                          onClick={() => {
                            const bets = c.coupon_bets?.map(b => `⚽ ${b.match_label} → ${b.market_label} (${b.odd})`).join('\n') ?? ''
                            const text = encodeURIComponent(`WC26 Predictor - Kuponum 🎯\n\n${bets}\n\nToplam: ${c.total_odd}x\nhttps://wc26-predictor-orcin.vercel.app #FIFA2026 #WorldCup2026`)
                            window.open(`https://twitter.com/intent/tweet?text=${text}`)
                          }}
                          className="flex-1 text-[10px] font-mono py-1.5 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
                        >
                          𝕏 Twitter
                        </button>
                        <button
                          onClick={() => {
                            const bets = c.coupon_bets?.map(b => `⚽ ${b.match_label} → ${b.market_label} (${b.odd})`).join('\n') ?? ''
                            const text = encodeURIComponent(`WC26 Predictor - Kuponum 🎯\n\n${bets}\n\nToplam: ${c.total_odd}x\nhttps://wc26-predictor-orcin.vercel.app`)
                            window.open(`https://wa.me/?text=${text}`)
                          }}
                          className="flex-1 text-[10px] font-mono py-1.5 rounded border border-white/10 text-white/40 hover:text-grass-400 hover:border-grass-500/30 transition-colors"
                        >
                          WhatsApp
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(`https://wc26-predictor-orcin.vercel.app/profile/${profile?.username}`)}
                          className="flex-1 text-[10px] font-mono py-1.5 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
                        >
                          Linki Kopyala
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
