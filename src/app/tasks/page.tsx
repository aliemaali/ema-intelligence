export const metadata = { title: 'Aufgaben' }
export default function TasksPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Aufgaben</h1>
        <button className="btn-primary">+ Aufgabe</button>
      </div>
      <div className="empty-state mt-10">
        <p className="text-base font-medium">Keine offenen Aufgaben</p>
      </div>
    </div>
  )
}
