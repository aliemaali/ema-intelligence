# EMA Central Reminders

Shared reminder foundation for EMA Office and EMA Intelligence.

## Flow
1. Authenticated EMA user creates a reminder.
2. One or more EMA user IDs are assigned as recipients (for example Ali, Tuba, or both).
3. Each recipient registers their own iPhone/PWA push subscription after granting notification permission.
4. A trusted server-side dispatcher queries due reminders and sends Web Push to every registered device for every selected recipient.
5. Delivery is recorded per recipient; reminder is marked sent after processing.

## Security
- Push subscriptions are private per authenticated user via RLS.
- Reminder recipients are stored by user ID, never hard-coded by name.
- The dispatcher must run server-side with trusted credentials.
- VAPID private keys must be environment secrets and must never be exposed to the browser.

## iPhone
Web Push requires the EMA web app to be installed on the iPhone Home Screen and notification permission to be granted by that user. Each recipient/device must opt in once.

## Remaining integration
- Reminder creation API/server action.
- Recipient picker backed by EMA users/profiles.
- Push subscription API and UI opt-in.
- Server-side Web Push sender + scheduled dispatcher.
- Connect existing Office/Intelligence reminder forms to the shared API.
- Preview migration, build/type/lint tests, then device test with both recipient accounts.
