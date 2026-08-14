export type DocumentInvestor = {
  id: string
  company: string
  contactPerson: string
  email: string
  phone: string
  street: string
  postalCode: string
  city: string
  country: string
}

export function documentInvestorLabel(investor: DocumentInvestor) {
  return [investor.company, investor.contactPerson].filter(Boolean).join(' · ') || 'Investor'
}

export function partialInvestorAddress(investor: DocumentInvestor) {
  return [investor.street, [investor.postalCode, investor.city].filter(Boolean).join(' '), investor.country].filter(Boolean).join(', ')
}
