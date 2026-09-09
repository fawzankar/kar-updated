import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans-custom' })
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], variable: '--font-serif-custom', weight: '400' })

export const metadata: Metadata = {
  title: "Fowzan's Inbox — Anonymous messages",
  description: 'Leave Fowzan an anonymous question, thought, or reply.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: "Fowzan's Inbox",
    description: 'Leave an anonymous message for Fowzan.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: "Fowzan's Inbox",
    description: 'Leave an anonymous message for Fowzan.',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#151b2b',
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${dmSans.variable} ${instrumentSerif.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
