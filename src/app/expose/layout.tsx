import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Investment Memorandum | EMA Intelligence',
  description: 'Institutionelles Investment Memorandum für Energieprojekte',
}

export default function ExposeLayout({ children }: { children: React.ReactNode }) {
  return children
}
