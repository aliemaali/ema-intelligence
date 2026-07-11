import { CustomerIntakeFormV2 } from '@/components/customer-intake/CustomerIntakeFormV2'

export const metadata = {
  title: 'Kundenaufnahme',
  description: 'Kundenaufnahme direkt in EMA Intelligence speichern',
}

export default function CustomerIntakePage() {
  return <CustomerIntakeFormV2 />
}
