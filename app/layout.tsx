import type { Metadata, Viewport } from 'next'
import { Archivo, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { AppProvider } from '@/components/app-provider'
import { BOOT_SCRIPT, DEV_ERROR_SCRIPT } from './boot-script'
import './globals.css'

const display = Archivo({ variable: '--font-display', subsets: ['latin'], axes: ['wdth'] })
const body = Instrument_Sans({ variable: '--font-body', subsets: ['latin'] })
const mono = JetBrains_Mono({ variable: '--font-mono', subsets: ['latin'], weight: ['400', '600'] })

const title = 'Zamu: your chama, paid straight to M-Pesa'
const description =
  'A chama where, when it’s your turn, everyone’s share lands straight in your M-Pesa in exact shillings, and the whole group sees every receipt. Runs inside Nimiq Pay.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title,
  description,
  applicationName: 'Zamu',
  openGraph: { title, description, siteName: 'Zamu', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3ecdf' },
    { media: '(prefers-color-scheme: dark)', color: '#16110c' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
      // Nimiq Pay sets safe-area variables on <html> before hydration.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        {process.env.NODE_ENV !== 'production' && <script dangerouslySetInnerHTML={{ __html: DEV_ERROR_SCRIPT }} />}
      </head>
      <body className="relative min-h-full">
        <AppProvider>
          <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">{children}</div>
        </AppProvider>
      </body>
    </html>
  )
}
