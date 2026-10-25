import Image from 'next/image'
import Link from 'next/link'
import { BarChart3, CalendarDays, FileText, FolderOpen, Mail, Orbit } from 'lucide-react'
import styles from './control.module.css'

type Area = 'intelligence' | 'office' | 'dms' | 'expose'
export function ControlHero({ area = 'intelligence', title, subtitle, children }: { area?: Area; title: string; subtitle: string; children?: React.ReactNode }) {
  return <section className={`${styles.hero} ${styles[area]}`}>
    <div className={styles.heroText}><span className={styles.pill}><Orbit size={14} />{area === 'intelligence' ? 'Dein Überblick' : `EMA ${area === 'dms' ? 'DMS' : area === 'expose' ? 'Exposé' : 'Office'}`}</span><h1>{title}</h1><p>{subtitle}</p></div>
    <div className={styles.universe}><Image src="/brand/ema-control-globe.webp" width={800} height={800} alt="" sizes="(max-width: 600px) 210px, 360px" priority className={styles.globe} />
      <Link href="/microsoft" className={`${styles.satellite} ${styles.satMail}`}><span><Mail /></span><small>E-Mails<br />Kalender</small></Link>
      <a href="/office" className={`${styles.satellite} ${styles.satOffice}`}><span><BarChart3 /></span><small>Office<br />Rechnungen</small></a>
      <Link href="/dms" className={`${styles.satellite} ${styles.satDms}`}><span><FolderOpen /></span><small>DMS<br />Dokumente</small></Link>
      <Link href="/expose" className={`${styles.satellite} ${styles.satExpose}`}><span><FileText /></span><small>Exposé<br />Projekte</small></Link>
    </div>
    {children ? <div className={styles.heroAction}>{children}</div> : null}
  </section>
}
export function ConnectedAreas() {
  return <section className={styles.connected}><h2><Orbit size={19} />Verbundene Apps</h2><div className={styles.appLinks}>
    <a href="/office"><span className={styles.appOffice}><BarChart3 /></span><strong>Office</strong></a>
    <Link href="/expose"><span className={styles.appExpose}><FileText /></span><strong>Exposé</strong></Link>
    <Link href="/dms"><span className={styles.appDms}><FolderOpen /></span><strong>DMS</strong></Link>
  </div></section>
}
export function CalendarArtwork({ time }: { time: string }) { return <div className={styles.calendarArt} aria-hidden="true"><div className={styles.calendarBinding} /><span>{time}</span><CalendarDays /></div> }
