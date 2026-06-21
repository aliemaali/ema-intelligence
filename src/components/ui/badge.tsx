import { cn } from '@/lib/utils'

/**
 * Generic Badge component – no external dependency.
 * Radix UI has no official `react-badge` primitive, so this is hand-built
 * to match the same visual language as StatusBadge/PriorityBadge/TypeBadge
 * in components/ui/index.tsx.
 *
 * Use this for ad-hoc badges that don't map to a domain enum
 * (status, priority, project type). For those, prefer the
 * specialized badges in components/ui/index.tsx.
 */

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'

interface BadgeProps {
  children:   React.ReactNode
  variant?:   BadgeVariant
  className?: string
  dot?:       boolean
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  outline: 'bg-transparent border border-border text-foreground',
}

const DOT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-muted-foreground',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  outline: 'bg-foreground',
}

export function Badge({
  children,
  variant = 'default',
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span className={cn('badge', VARIANT_STYLES[variant], className)}>
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT_STYLES[variant])} />
      )}
      {children}
    </span>
  )
}
