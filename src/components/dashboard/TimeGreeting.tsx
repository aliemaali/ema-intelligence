'use client'

import { useEffect, useState } from 'react'

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 11) return 'Guten Morgen'
  if (hour >= 11 && hour < 17) return 'Guten Tag'
  if (hour >= 17 && hour < 22) return 'Guten Abend'
  return 'Gute Nacht'
}

export function TimeGreeting() {
  const [greeting, setGreeting] = useState('Guten Tag')

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getGreeting(new Date().getHours()))
    }

    updateGreeting()
    const interval = window.setInterval(updateGreeting, 60 * 1000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.28em] text-[#5CB800] md:text-sm">
      {greeting}
    </p>
  )
}
