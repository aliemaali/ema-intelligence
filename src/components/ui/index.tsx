'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  PROJECT_TYPE_LABELS,
} from '@/lib/types/constants'
import type {
  ProjectStatus,
  ProjectPriority,
  ProjectType,
} from '@/lib/types/database.types'

// ── Status Badge ──────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const colors = PROJECT_STATUS_COLORS[status]
  const label  = PROJECT_STATUS_LABELS[status]
  return (
    <span className={cn('badge', colors.bg, colors.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', colors.dot)} />
      {label}
    </span>
  )
}

// ── Priority Badge ────────────────────────────────────────────────────────────

export function PriorityBadge({ priority }: { priority: ProjectPriority }) {
  const config = {
    hoch: 'Hoch',
    mittel: 'Mittel',
    niedrig: 'Niedrig'
  } as const

  const colors = {
    hoch: 'text-red-600',
    mittel: 'text-amber-600',
    niedrig: 'text-emerald-600'
  } as const

  const dots = {
    hoch: 'bg-red-500',
    mittel: 'bg-amber-500',
    niedrig: 'bg-emerald-500'
  } as const

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className={cn('w-2.5 h-2.5 rounded-full', dots[priority])} />
      <span className={cn('text-sm font-medium', colors[priority])}>
        {config[priority]}
      </span>
    </div>
  )
}

// ── Type Badge// ── Type Badge ────────────────────────────────────────────────────────────────

export function TypeBadge({ type }: { type: ProjectType }) {
  const colors: Record<ProjectType, string> = {
    pv_freiflaeche: 'bg-yellow-100 text-black',
    pv_dach:        'bg-orange-100 text-black',
    bess:           'bg-blue-100 text-black',
    hybrid:         'bg-purple-100 text-black',
    wind:           'bg-teal-100 text-black',
  }
  return (
    <span className={cn('badge', colors[type])}>
      {PROJECT_TYPE_LABELS[type]}
    </span>
  )
}

// ── Loading Spinner ───────────────────────────────────────────────────────────

export function LoadingSpinner({ size = 'md', className }: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <Loader2 className={cn('animate-spin text-muted-foreground', sizes[size], className)} />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <LoadingSpinner size="lg" />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, description, action,
}: {
  icon?:        React.ReactNode
  title:        string
  description?: string
  action?:      React.ReactNode
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl mb-1">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="text-sm max-w-xs">{description}</p>}
      {action}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function CardSkeleton() {
  return (
    <div className="card-padded space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open, onClose, onConfirm,
  title, description,
  confirmLabel = 'Bestätigen',
  danger = false,
  loading = false,
}: {
  open:          boolean
  onClose:       () => void
  onConfirm:     () => void
  title:         string
  description:   string
  confirmLabel?: string
  danger?:       boolean
  loading?:      boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md mx-4 mb-4 sm:mb-0 bg-card rounded-xl border border-border shadow-xl p-5 animate-slide-up">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
          <button onClick={onClose} className="btn-icon ml-auto text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary btn-sm">Abbrechen</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'btn btn-sm',
              danger
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'btn-primary',
              'disabled:opacity-50 disabled:pointer-events-none'
            )}
          >
            {loading ? <LoadingSpinner size="sm" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section Header ────────────────────────────────────────────────────────────

export function SectionHeader({ title, action }: {
  title:   string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {action}
    </div>
  )
}

// ── Info Row ──────────────────────────────────────────────────────────────────

export function InfoRow({ label, value, mono = false }: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-3">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className={cn('text-sm text-foreground text-right', mono && 'font-mono')}>
        {value ?? '–'}
      </span>
    </div>
  )
}

// ── Dev Status Dot ────────────────────────────────────────────────────────────

export function DevStatusDot({ value }: { value: boolean | null }) {
  if (value === true)  return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
  if (value === false) return <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
  return <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 border border-border shrink-0" />
}

// ── Number Input ──────────────────────────────────────────────────────────────

export function NumberInput({
  label, name, defaultValue, placeholder, unit, required, step = '0.001',
}: {
  label:         string
  name:          string
  defaultValue?: number | null
  placeholder?:  string
  unit?:         string
  required?:     boolean
  step?:         string
}) {
  return (
    <div>
      <label htmlFor={name} className="form-label">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type="number"
          step={step}
          min="0"
          required={required}
          placeholder={placeholder ?? '0'}
          defaultValue={defaultValue ?? undefined}
          className="form-input pr-14"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
