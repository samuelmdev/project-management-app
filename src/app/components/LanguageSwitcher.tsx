'use client'

import { usePathname, useRouter } from 'next/navigation'

export default function LanguageSwitcher() {
  const pathname = usePathname()
  const router = useRouter()

  const switchLocale = (locale: string) => {
    const segments = pathname.split('/')
    segments[1] = locale // Replace the language segment
    const newPath = segments.join('/')
    router.push(newPath)
  }

  return (
    <div className="flex gap-2 items-center">
      <button onClick={() => switchLocale('en')} className="text-sm underline">
        EN
      </button>
      <span>/</span>
      <button onClick={() => switchLocale('fi')} className="text-sm underline">
        FI
      </button>
    </div>
  )
}
