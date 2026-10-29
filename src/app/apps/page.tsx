import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Building2, Files, Orbit, ScanLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import styles from './launcher.module.css'
import { ThemeToggle } from '@/components/ThemeRuntime'

const officeUrl = '/office'

export default async function AppsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/apps')

  return <main className={styles.launcher}>
    <div className={styles.themeControl}><ThemeToggle /></div>
    <div className={styles.backdrop} aria-hidden="true" />
    <div className={styles.brand}><Image src="/brand/ema-mark-white.png" alt="EMA Enterprise" width={506} height={247} priority className={`${styles.brandLogo} ema-logo-dark`} /><Image src="/brand/ema-mark.png" alt="EMA Enterprise" width={506} height={247} className={`${styles.brandLogo} ema-logo-light`} /></div>
    <section className={styles.grid} aria-label="EMA Anwendungen">
      <Link href="/dashboard" className={`${styles.card} ${styles.intelligence}`} aria-label="EMA Intelligence öffnen"><span className={styles.visual}><Orbit /></span><strong>EMA Intelligence</strong><small>Dein persönlicher Assistent</small></Link>
      <a href={officeUrl} className={`${styles.card} ${styles.office}`} aria-label="EMA Office öffnen"><span className={styles.visual}><Building2 /></span><strong>EMA Office</strong><small>Angebote & Rechnungen</small></a>
      <Link href="/dms" className={`${styles.card} ${styles.dms}`} aria-label="EMA DMS öffnen"><span className={styles.visual}><Files /></span><strong>EMA DMS</strong><small>Dokumente & Datenräume</small></Link>
      <Link href="/expose" className={`${styles.card} ${styles.expose}`} aria-label="EMA Exposé öffnen"><span className={styles.visual}><FileText /></span><strong>EMA Exposé</strong><small>BESS · PV · Data Center</small></Link>
      <Link href="/smart-check" className={`${styles.card} ${styles.smartCheck}`} aria-label="EMA Smart Check öffnen"><span className={styles.visual}><ScanLine /></span><strong>EMA Smart Check</strong><small>Fotografieren · Analysieren · Bewerten</small></Link>
    </section>
  </main>
}

