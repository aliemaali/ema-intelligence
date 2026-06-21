'use client'

interface ExposeClientProps {
  projectId: string
  initialExpose: any
}

export function ExposeClient({
  projectId,
  initialExpose
}: ExposeClientProps) {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold mb-2">
        Exposé Modul
      </h2>

      <p className="text-muted-foreground">
        Exposé-Funktion wird vorbereitet.
      </p>

      <div className="mt-4 text-sm">
        Projekt-ID: {projectId}
      </div>
    </div>
  )
}