import type { Metadata } from 'next'
import { Inter, Space_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { BetslipProvider } from '@/lib/betslip-context'
import { UserProvider } from '@/lib/user-context'

const inter   = Inter({ subsets: ['latin'], variable: '--font-body' })
const mono    = Space_Mono({ weight: ['400','700'], subsets: ['latin'], variable: '--font-mono' })
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'WC26 Predictor',
  description: 'FIFA 2026 Dünya Kupası yapay zeka tahminleri',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${mono.variable} ${display.variable}`}>
      <body>
        <UserProvider>
          <BetslipProvider>
            {children}
          </BetslipProvider>
        </UserProvider>
      </body>
    </html>
  )
}
