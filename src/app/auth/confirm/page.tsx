// app/auth/confirm/page.tsx
"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "../../lib/supabase/client"

function ConfirmClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/"

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const access_token = params.get("access_token")
    const refresh_token = params.get("refresh_token")

    if (access_token && refresh_token) {
      const supabase = createClient()
      supabase.auth.setSession({ access_token, refresh_token }).then(() => {
        router.replace(next)
      })
    } else {
      router.replace("/login?checkEmail=1")
    }
  }, [router, next])

  return <p>Confirming your email...</p>
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<p>Confirming your email...</p>}>
      <ConfirmClient />
    </Suspense>
  )
}
