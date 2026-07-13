'use client'

import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { softDeleteAcquisitionLead } from '@/lib/actions/lead-delete.actions'

type Props = {
  leadId: string
  companyName: string
  children: ReactNode
}

const SWIPE_THRESHOLD = 55
const ACTION_WIDTH = 104

export default function SwipeDeleteLeadCard({ leadId, companyName, children }: Props) {
  const startX = useRef<number | null>(null)
  const [open, setOpen] = useState(false)

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    startX.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (startX.current === null) return
    const endX = event.changedTouches[0]?.clientX ?? startX.current
    const distance = endX - startX.current

    if (distance < -SWIPE_THRESHOLD) setOpen(true)
    if (distance > SWIPE_THRESHOLD) setOpen(false)
    startX.current = null
  }

  return (
    <div className="relative overflow-hidden bg-red-600">
      <form
        action={softDeleteAcquisitionLead}
        onSubmit={(event) => {
          const confirmed = window.confirm(`Lead „${companyName}“ wirklich löschen?`)
          if (!confirmed) event.preventDefault()
        }}
        className="absolute inset-y-0 right-0 flex w-[104px] items-center justify-center"
      >
        <input type="hidden" name="lead_id" value={leadId} />
        <button type="submit" className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-white" aria-label={`${companyName} löschen`}>
          <Trash2 className="h-5 w-5" />
          Löschen
        </button>
      </form>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => open && setOpen(false)}
        className="relative bg-white transition-transform duration-200 ease-out"
        style={{ transform: open ? `translateX(-${ACTION_WIDTH}px)` : 'translateX(0)' }}
      >
        {children}
      </div>
    </div>
  )
}
