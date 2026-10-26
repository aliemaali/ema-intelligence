import {redirect} from 'next/navigation'
import {checkContext,CheckError} from '@/lib/smart-check/server'
import SmartCheck from '@/components/smart-check/PhotoCheck'
export const metadata={title:'EMA Smart Check',robots:{index:false,follow:false}}
export const dynamic='force-dynamic'
export default async function SmartCheckPage(){try{await checkContext()}catch(error){if(error instanceof CheckError && error.status===401)redirect('/login?redirectTo=/smart-check');return <main style={{padding:32,color:'#eaf7ff',background:'#041126',minHeight:'100dvh'}}><h1>Smart Check nicht verfügbar</h1><p>Bitte aktiven internen Zugang und gegebenenfalls Zwei-Faktor-Anmeldung prüfen.</p><a href="/apps">Zur Hauptseite</a></main>}return <SmartCheck officePreparationUrl={process.env.VERCEL_ENV==='preview'?'https://ema-office-git-codex-ema-smart-check-ema-intelligence.vercel.app/office/vertrieb/smart-check':'/office/vertrieb/smart-check'} />}
