'use client'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Profile, UserBadge, Coupon } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile | null
  badges: UserBadge[]
  coupons: Coupon[]
  followersCount: number
  followingCount: number
}

export default function ProfileClient({ profile, badges, coupons, followersCount, followingCount }: Props) {
  const supabase = createClient()
  const router   = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const wonCoupons  = coupons.filter(c => c.status === 'won').length
  const lostCoupons = coupons.filter(c => c.status === 'lost').length

  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/" />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profil kartı */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-grass-500/20 border border-grass-500/30 flex items-center justify-center text-2xl">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : '👤'}
            </div>
            <div>
              <h1 className="text-lg font-medium text-chalk-100">@{profile?.username}</h1>
              <p className="text-xs font-mono text-white/35">
                {new Date(profile?.created_at ?? '').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} tarihinden beri üye
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-mono font-medium text-gold-300">{profile?.points ?? 0}</p>
              <p className="text-[10px] font-mono text-white/35">puan</p>
            </div>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Kupon', value: coupons.length },
              { label: 'Kazanan', value: wonCoupons },
              { label: 'Takipçi', value: followersCount },
              { label: 'Takip', value: followingCount },
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
            <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest">Son Kuponlar</h2>
            <Link href="/" className="text-[10px] font-mono text-grass-400 hover:text-grass-300">
              + Yeni kupon oluştur
            </Link>
          </div>
          {coupons.length === 0 ? (
            <p className="text-xs font-mono text-white/25 text-center py-6">Henüz kupon oluşturmadın</p>
          ) : (
            <div className="space-y-3">
              {coupons.map(c => (
                <div key={c.id} className="bg-white/[0.02] rounded-lg border border-white/5 overflow-hidden">
                  {/* Kupon header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                    <div>
                      <p className="text-xs font-mono text-white/70">{c.title || `${c.coupon_bets?.length ?? 0} maçlık kupon`}</p>
                      <p className="text-[10px] font-mono text-white/30 mt-0.5">
                        {new Date(c.created_at).toLocaleDateString('tr-TR')} · Toplam oran: <span className="text-gold-300">{c.total_odd}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.points_won > 0 && (
                        <span className="text-[10px] font-mono text-gold-400">+{c.points_won} puan</span>
                      )}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        c.status === 'won'  ? 'bg-grass-500/20 text-grass-300' :
                        c.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {c.status === 'won' ? '✅ Kazandı' : c.status === 'lost' ? '❌ Kaybetti' : '⏳ Bekliyor'}
                      </span>
                    </div>
                  </div>
                  {/* Bahis detayları */}
                  {c.coupon_bets && c.coupon_bets.length > 0 && (
                    <div className="divide-y divide-white/5">
                      {c.coupon_bets.map(b => (
                        <div key={b.id} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              b.result === 'won'  ? 'bg-grass-400' :
                              b.result === 'lost' ? 'bg-red-400' :
                              'bg-white/20'
                            }`} />
                            <p className="text-[10px] font-mono text-white/50 truncate">{b.match_label}</p>
                            <span className="text-[10px] font-mono text-white/25 flex-shrink-0">{b.market_label}</span>
                          </div>
                          <span className="text-[10px] font-mono text-grass-300 ml-2 flex-shrink-0">{b.odd}</span>
                        </div>
                      ))}
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
