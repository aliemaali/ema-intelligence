import { redirect } from 'next/navigation';
import { EMA_ROUTES } from '@/lib/ema/routes';
export default function CalendarPage() { redirect(EMA_ROUTES.calendar); }
