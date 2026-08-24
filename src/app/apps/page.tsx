import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './launcher.module.css'

const officeUrl =
  process.env.NEXT_PUBLIC_EMA_OFFICE_URL ??
  'https://ema-office-git-feat-sprint13-16-operati-67ab21-ema-intelligence.vercel.app'

export default async function AppsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirectTo=/apps')

  return (
    <main className={styles.launcher}>
      <div className={styles.landscape} aria-label="EMA Anwendungen">
        <div className={styles.referenceArtwork} aria-hidden="true" />

        <Link
          href="/dashboard"
          aria-label="EMA Intelligence öffnen"
          className={`${styles.hotspot} ${styles.intelligenceHotspot}`}
        />
        <a
          href={officeUrl}
          aria-label="EMA Office öffnen"
          className={`${styles.hotspot} ${styles.officeHotspot}`}
        />
      </div>

      <div className={styles.portrait} aria-label="EMA Anwendungen">
        <div className={styles.portraitBackdrop} aria-hidden="true" />
        <div className={styles.brandMark} aria-hidden="true" />

        <div className={styles.portraitCards}>
          <Link
            href="/dashboard"
            aria-label="EMA Intelligence öffnen"
            className={`${styles.referenceCrop} ${styles.intelligenceCard}`}
          />
          <a
            href={officeUrl}
            aria-label="EMA Office öffnen"
            className={`${styles.referenceCrop} ${styles.officeCard}`}
          />
        </div>
      </div>
    </main>
  )
}
