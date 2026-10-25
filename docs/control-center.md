# EMA control center

The approved blue/cyan/green design is implemented as real controls and text. `public/brand/ema-control-globe.webp` is the same transparent, optimized graphic in Intelligence, DMS, Exposé and Office. It is 175 KB and does not require WebGL or looping video.

The dashboard loads its authenticated project/task seed first. Microsoft and Office queries run in the browser afterwards, with private no-store responses. No mock data or connected status is shipped to production. Mail ranking uses Outlook importance/flags, deadline terms, unread status, and invoice terms with an attachment; it is a prioritization hint rather than a guarantee. The latest 25 messages per mailbox are considered.

Microsoft access:
- Reconnect through the dashboard's Microsoft permissions link once to consent to Mail.Read and Mail.Read.Shared.
- Exchange must grant the connected account access to info@ema-enterprise.de; OAuth scope alone does not grant mailbox access.
- Both mailboxes have independent success/permission states.
- Existing refresh grants retain their granted scopes, so older calendar connections are not silently broadened.

Office integration:
- A normal Office session with the appropriate company permissions is required. No tokens or passwords are copied between apps.
- Enable the existing invoice intake in Office / Integrationen, then select "Beide Postfächer abgleichen" in Intelligence to register both mailboxes and their subscriptions.
- Import uses Office's original-file storage, SHA-256 duplicate detection, OCR/intake and review workflow. No automatic payment or final invoice approval.
- Per-mailbox delta/subscription state prevents one denied mailbox from resetting the other. New mailbox source IDs are namespaced; primary legacy IDs remain compatible.
- Subject/filename invoice hints filter out ordinary project PDFs. Ambiguous documents can still be uploaded manually.
- Microsoft webhook notifications plus the existing daily maintenance cron continue subsequent imports. Failure to register a notification is surfaced to the user.

The voice/text assistant opens on request. The ordinary dashboard no longer prewarms a paid Realtime connection on every visit. Written commands use Realtime text output and the same authenticated tool dispatcher and confirmation rules as voice commands.

Verification: type checks and production builds for both applications; mail-priority/link tests; mocked Office integration checks for two inboxes, source attachments, subscriptions, duplicate processing, delta state and partial failures; mobile UI checks with explicit QA fixtures. Authenticated Microsoft, Office and live voice flows still require a signed-in test and consent.
