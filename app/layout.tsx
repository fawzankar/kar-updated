import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Press_Start_2P, Space_Mono } from 'next/font/google'
import './globals.css'

const spaceMono = Space_Mono({ subsets: ['latin'], variable: '--font-sans-custom', weight: ['400', '700'] })
const pressStart = Press_Start_2P({ subsets: ['latin'], variable: '--font-display', weight: '400' })

export const metadata: Metadata = {
  title: "Fowzan's Inbox",
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
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var e=localStorage.getItem('fowzan-experience'),t=localStorage.getItem('fowzan-theme');if(e==='gamer'||e==='professional')document.documentElement.dataset.fowzanMode=e;if(t)document.documentElement.dataset.fowzanTheme=t}catch(_){}})()` }} />
      </head>
      <body className={`${spaceMono.variable} ${pressStart.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
