'use client'
import { Navbar } from '@/components/Navbar'

interface LeaderUser {
  id: string
  username: string
  avatar_url: string | null
  points: number
}

interface Props {
  topUsers: LeaderUser[]
  currentUserId?: string
}

const RANK_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardClient({ topUsers, currentUserId }: Props) {
  return (
    <div className="min-h-screen pitch-stripes">
      <Navbar active="/leaderboard" />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl text-chalk-50 tracking-wide">
            LİDER<br /><span className="text-gold-300">BOARD</span>
          </h1>
          <p className="text-xs font-mono text-white/35 mt-2">Kupon kazananlar puan toplar · Her hafta güncellenir</p>
        </div>

        {/* Puan sistemi */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: '🎯', label: 'Kupon oluştur', points: '+5' },
            { icon: '✅', label: 'Kazanan bahis', points: '+10' },
            { icon: '⭐', label: 'Takipçi kazan', points: '+2' },
          ].map(p => (
            <div key={p.label} className="bg-white/[0.02] border border-white/8 rounded-lg p-3 text-center">
              <span className="text-2xl">{p.icon}</span>
              <p className="text-[10px] font-mono text-white/40 mt-1">{p.label}</p>
              <p className="text-sm font-mono font-medium text-gold-300">{p.points} puan</p>
            </div>
          ))}
        </div>

        {/* Liste */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] border-b border-white/8">
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">Sıra · Kullanıcı</span>
            <span className="text-[9px] font-mono text-white/25 uppercase tracking-widest">Puan</span>
          </div>

          {topUsers.length === 0 ? (
            <div className="text-center py-12 text-white/25 font-mono text-sm">
              Henüz kullanıcı yok. İlk sen ol!
            </div>
          ) : (
            topUsers.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/[0.02] ${u.id === currentUserId ? 'bg-grass-500/5 border-l-2 border-l-grass-500' : ''}`}
              >
                <span className="w-6 text-sm text-center">
                  {RANK_ICONS[i+1] ?? <span className="text-[11px] font-mono text-white/30">{i+1}</span>}
                </span>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm flex-shrink-0 overflow-hidden">
                  {u.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    : '👤'
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-mono truncate ${u.id === currentUserId ? 'text-grass-300 font-medium' : 'text-white/70'}`}>
                    @{u.username}
                    {u.id === currentUserId && <span className="text-[10px] text-grass-500 ml-2">sen</span>}
                  </p>
                </div>
                <span className={`text-sm font-mono font-medium ${i === 0 ? 'text-gold-300' : i < 3 ? 'text-chalk-200' : 'text-white/50'}`}>
                  {u.points}
                </span>
              </div>
            ))
          )}
        </div>

        {!currentUserId && (
          <div className="mt-6 text-center">
            <p className="text-xs font-mono text-white/35 mb-3">Puan toplamak için giriş yap</p>
            <Link href="/auth" className="inline-block bg-grass-500 text-white rounded-lg px-6 py-2 text-sm font-mono hover:bg-grass-400 transition-colors">
              Giriş Yap / Kayıt Ol
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
