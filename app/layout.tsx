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
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement,e=localStorage.getItem('fowzan-experience'),t=localStorage.getItem('fowzan-theme');var valid=['white','green','purple','red','blue','rose','amber','slate','mono'];if(e==='gamer'||e==='professional'){d.dataset.fowzanMode=e;d.classList.add('fowzan-prehydrated');}if(e==='professional'&&t==='red'){t='blue';localStorage.setItem('fowzan-theme','blue');}if(valid.indexOf(t)>=0){d.dataset.fowzanTheme=t;}if(e==='professional'&&t==='blue'){d.style.setProperty('--bootstrap-bg','#f3f7fa');}else if(e==='professional'&&t==='rose'){d.style.setProperty('--bootstrap-bg','#fbf4f5');}else if(e==='professional'&&t==='purple'){d.style.setProperty('--bootstrap-bg','#f7f4fa');}else if(e==='professional'&&t==='mono'){d.style.setProperty('--bootstrap-bg','#f4f4f2');}else if(e==='gamer'){d.style.setProperty('--bootstrap-bg','#030403');}else{d.style.setProperty('--bootstrap-bg','#060807');}d.style.colorScheme=e==='professional'?'light':'dark';}catch(_){}})()` }} />
      </head>
      <body className={`${spaceMono.variable} ${pressStart.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
