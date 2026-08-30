import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AudioWaveform, Building2, Files, Orbit } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import styles from './launcher.module.css'

const officeUrl = '/office'

export default async function AppsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/apps')

  return <main className={styles.launcher}>
    <div className={styles.backdrop} aria-hidden="true" />
    <div className={styles.brand}><Image src="/brand/ema-mark-white.png" alt="EMA Enterprise" width={506} height={247} priority className={styles.brandLogo} /></div>
    <section className={styles.grid} aria-label="EMA Anwendungen">
      <Link href="/dashboard" className={`${styles.card} ${styles.intelligence}`} aria-label="EMA Intelligence öffnen"><span className={styles.visual}><Orbit /></span><strong>EMA Intelligence</strong><small>Projekte & Investments</small></Link>
      <a href={officeUrl} className={`${styles.card} ${styles.office}`} aria-label="EMA Office öffnen"><span className={styles.visual}><Building2 /></span><strong>EMA Office</strong><small>Unternehmenssteuerung</small></a>
      <Link href="/dms" className={`${styles.card} ${styles.dms}`} aria-label="EMA DMS öffnen"><span className={styles.visual}><Files /></span><strong>EMA DMS</strong><small>Dokumente & Datenräume</small></Link>
      <Link href="/ema" className={`${styles.card} ${styles.ai}`} aria-label="EMA AI Sprachassistent öffnen"><span className={styles.visual}><AudioWaveform /></span><strong>EMA AI</strong><small>Sprachassistent</small></Link>
    </section>
  </main>
}
