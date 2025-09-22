'use client'

import type { User } from '@supabase/auth-helpers-nextjs'

export default function DashboardClient({ user }: { user: User }) {
  return <p>Hello {user.email ?? 'Anonymous'}</p>
}
