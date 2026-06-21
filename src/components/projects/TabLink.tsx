'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function TabLinkClient({
  href,
  label,
}: {
  href:  string
  label: string
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'shrink-0 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
        isActive
          ? 'border-[#5CB800] text-[#5CB800]'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
      )}
    >
      {label}
    </Link>
  )
}
