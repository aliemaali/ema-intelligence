export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white [&_main]:!bg-white">
      {children}
    </div>
  )
}
