import './globals.css'
import { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { LocaleProvider } from './lib/i18n/locale-provider'
import { AppCacheProvider } from './lib/cache/AppCacheProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Project manager',
  description: 'Track your projects with ease.',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <LocaleProvider>
            <AppCacheProvider>
              {children}
            </AppCacheProvider>
          </LocaleProvider>
        </Providers>
      </body>
    </html>
  )
}