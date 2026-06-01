import type { Metadata } from 'next'
import './globals.css'
import { BetslipProvider } from '@/lib/betslip-context'

export const metadata: Metadata = {
  title: 'WC26 Predictor',
  description: 'FIFA 2026 Dünya Kupası yapay zeka tahminleri',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <BetslipProvider>
          {children}
        </BetslipProvider>
      </body>
    </html>
  )
}
