export const metadata = { title: 'Partner' }
export default function PartnersPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Partner</h1>
        <button className="btn-primary">+ Partner hinzufügen</button>
      </div>
      <div className="empty-state mt-10">
        <p className="text-base font-medium">Noch keine Partner</p>
      </div>
    </div>
  )
}
