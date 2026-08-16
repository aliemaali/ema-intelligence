# EMA Assistant deployment

Before production:
1. Apply assistant schema migration.
2. Create VAPID key pair and configure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Vercel plus `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `EMA_CRON_SECRET` for the Edge Function.
3. Create Supabase Vault secrets `project_url` and `ema_cron_secret`.
4. Deploy `ema-reminder-push` with JWT verification disabled ONLY because it authenticates every request with the private `x-ema-cron-secret` header.
5. Apply cron migration.
6. Run Supabase security advisors and verify Ali/Tuba isolation using two authenticated sessions.
7. On each iPhone, install EMA to the Home Screen and press “Erinnerungen aktivieren”.

Do not merge/deploy until build, lint, typecheck and the above security checks pass.
