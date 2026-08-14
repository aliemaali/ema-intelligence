export type DocumentInvestor = {
  id: string
  company: string
  contactPerson: string
  email: string
  phone: string
  city: string
  country: string
}

export function documentInvestorLabel(investor: DocumentInvestor) {
  return [investor.company, investor.contactPerson].filter(Boolean).join(' · ') || 'Investor'
}

export function partialInvestorAddress(investor: DocumentInvestor) {
  return [investor.city, investor.country].filter(Boolean).join(', ')
}
