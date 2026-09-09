import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Orbitron } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans-custom' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-serif-custom', weight: ['500', '700'] })

export const metadata: Metadata = {
  title: "Fowzan Kar — Anonymous Drop",
  description: 'Leave Fowzan Kar an anonymous question, thought, or reply.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Fowzan Kar — Anonymous Drop',
    description: 'Leave an anonymous message for Fowzan Kar.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Fowzan Kar — Anonymous Drop',
    description: 'Leave an anonymous message for Fowzan Kar.',
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
      <body className={`${dmSans.variable} ${orbitron.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
