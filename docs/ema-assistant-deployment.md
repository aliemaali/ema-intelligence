# EMA Assistant deployment

Production checklist: apply schema migration; configure VAPID and EMA_CRON_SECRET; create Vault secrets project_url and ema_cron_secret; deploy ema-reminder-push; apply cron migration; run security advisors and Ali/Tuba isolation test; run build, lint and typecheck; then merge and deploy. Each iPhone must install EMA to the Home Screen and activate reminders once.
