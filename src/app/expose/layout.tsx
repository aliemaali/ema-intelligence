import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Exposé | EMA Intelligence',
  description: 'Institutionelles Exposé für Energieprojekte',
}

export default function ExposeLayout({ children }: { children: React.ReactNode }) {
  return children
}
