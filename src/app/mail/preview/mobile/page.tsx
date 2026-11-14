import Link from "next/link";
export const metadata = {
  title: "EMA Mail – mobile Vorschau",
  robots: { index: false, follow: false },
};
export default function MobilePreview() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#071019",
        color: "#c5d7df",
        padding: "20px",
        display: "grid",
        justifyItems: "center",
        gap: "16px",
      }}
    >
      <header style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>EMA Mail · mobile Vorschau</h1>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          390 × 844 · Demo ohne echte E-Mails
        </p>
        <Link href="/mail/preview" style={{ fontSize: 12, color: "#74dfb7" }}>
          Desktop-Vorschau öffnen
        </Link>
      </header>
      <iframe
        src="/mail/preview"
        title="EMA Mail im iPhone-Format"
        width="390"
        height="844"
        style={{
          maxWidth: "100%",
          border: "1px solid #2d4b53",
          borderRadius: 20,
          background: "#0b141e",
        }}
      />
    </main>
  );
}
