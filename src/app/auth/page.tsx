'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode]       = useState<'login'|'signup'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    setLoading(true); setError('')
    try {
      if (mode === 'signup') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { data: { username } }
        })
        if (signUpError) throw signUpError
        // Profili username ile güncelle
        if (signUpData.user) {
          await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            username: username || email.split('@')[0],
          })
        }
        setError('✅ Kayıt başarılı! Email onayını kontrol et.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        router.push('/')
        router.refresh()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata oluştu')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen pitch-stripes flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-chalk-50 tracking-wide">WC26</h1>
          <p className="text-xs font-mono text-white/35 mt-1">FIFA 2026 · Tahmin Platformu</p>
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6">
          {/* Tab */}
          <div className="flex mb-6 bg-white/[0.03] rounded-lg p-1">
            {(['login','signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-xs font-mono rounded-md transition-all ${mode===m ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text" placeholder="Kullanıcı adı"
                value={username} onChange={e => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 placeholder:text-white/25"
              />
            )}
            <input
              type="email" placeholder="Email"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 placeholder:text-white/25"
            />
            <input
              type="password" placeholder="Şifre"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 font-mono outline-none focus:border-grass-500/50 placeholder:text-white/25"
            />
          </div>

          {error && (
            <p className={`text-xs font-mono mt-3 ${error.startsWith('✅') ? 'text-grass-400' : 'text-red-400'}`}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit} disabled={loading}
            className="w-full mt-4 bg-grass-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-mono hover:bg-grass-400 transition-colors"
          >
            {loading ? 'Yükleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </div>
      </div>
    </div>
  )
}
