# EMA Assistant deployment

Before production:
1. Apply assistant schema migration.
2. Configure a VAPID key pair: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Vercel; `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `EMA_CRON_SECRET` for the Edge Function.
3. Create Supabase Vault secrets `project_url` and `ema_cron_secret`.
4. Deploy `ema-reminder-push`. JWT verification may be disabled only because the function rejects calls without the private `x-ema-cron-secret` value.
5. Apply the cron migration.
6. Run Supabase security advisors and verify Ali/Tuba isolation with two authenticated sessions.
7. On each iPhone install EMA to the Home Screen and press “Erinnerungen aktivieren”.

Production must wait until build, lint, typecheck and security checks pass.
