export const metadata = { title: 'Deals' }
export default function DealsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Deals</h1>
      </div>
      <div className="empty-state mt-10">
        <p className="text-base font-medium">Noch keine Deals</p>
        <p className="text-sm">Deals werden automatisch erstellt wenn ein Projekt einen Einkaufspreis hat.</p>
      </div>
    </div>
  )
}
