export const metadata = { title: 'Investoren' }
export default function InvestorsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Investoren</h1>
        <button className="btn-primary">+ Investor hinzufügen</button>
      </div>
      <div className="empty-state mt-10">
        <p className="text-base font-medium">Noch keine Investoren</p>
      </div>
    </div>
  )
}
