'use client'

import { useEffect } from 'react'

const STATE_ALIASES: Record<string, string> = {
  Bavaria: 'Bayern',
  'North Rhine-Westphalia': 'Nordrhein-Westfalen',
  'Lower Saxony': 'Niedersachsen',
  'Saxony-Anhalt': 'Sachsen-Anhalt',
  'Mecklenburg-Vorpommern': 'Mecklenburg-Vorpommern',
  'Rhineland-Palatinate': 'Rheinland-Pfalz',
  Thuringia: 'Thüringen',
}

export function CityStateAutoFill() {
  useEffect(() => {
    const cityElement = document.querySelector<HTMLInputElement>('input[name="location_city"]')
    const stateElement = document.querySelector<HTMLSelectElement>('select[name="location_state"]')
    if (!cityElement || !stateElement) return

    const cityInput = cityElement
    const stateSelect = stateElement

    async function resolveState() {
      const city = cityInput.value.trim()
      if (city.length < 2) return

      try {
        const response = await fetch(`/api/location-state?city=${encodeURIComponent(city)}`)
        if (!response.ok) return
        const result = await response.json() as { state?: string | null }
        const state = result.state ? (STATE_ALIASES[result.state] ?? result.state) : null
        if (!state || !Array.from(stateSelect.options).some((option) => option.value === state)) return

        stateSelect.value = state
        stateSelect.dispatchEvent(new Event('change', { bubbles: true }))
      } catch {
        // Die manuelle Auswahl bleibt immer möglich.
      }
    }

    cityInput.addEventListener('blur', resolveState)
    return () => cityInput.removeEventListener('blur', resolveState)
  }, [])

  return null
}
