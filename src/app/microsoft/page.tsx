import { redirect } from 'next/navigation';
import { EMA_ROUTES } from '@/lib/ema/routes';
export default function MicrosoftPage() { redirect(EMA_ROUTES.contacts); }
