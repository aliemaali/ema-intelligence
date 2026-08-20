'use client'

import { usePathname } from 'next/navigation'
import { PlaudDashboardCard } from './PlaudDashboardCard'

export function PlaudDashboardMount({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      {children}
      {pathname === '/dashboard' ? (
        <div className="mx-auto w-full max-w-[1180px] px-3 pb-8 md:px-0">
          <PlaudDashboardCard />
        </div>
      ) : null}
    </>
  )
}
