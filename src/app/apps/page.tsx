import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import styles from './launcher.module.css'

const officeUrl =
  process.env.NEXT_PUBLIC_EMA_OFFICE_URL ??
  'https://ema-office.vercel.app'

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
        <div className={styles.landscapeBrandPlate} aria-hidden="true">
          <Image src="/brand/ema-mark-white.png" alt="" width={506} height={247} priority className={styles.brandLogo} />
        </div>

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
        <Image src="/brand/ema-mark-white.png" alt="" width={506} height={247} priority className={styles.brandLogo} />

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
