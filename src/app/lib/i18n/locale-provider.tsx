'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/router'
import { en, fi } from './locales'
import React from 'react'

const translations: Record<string, Record<string, string>> = { en, fi }

export const LocaleContext = React.createContext(translations.en)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState('en')
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/fi')) setLocale('fi')
    else setLocale('en')
  }, [pathname])

  return (
    <LocaleContext.Provider value={translations[locale]}>
      {children}
    </LocaleContext.Provider>
  )
}