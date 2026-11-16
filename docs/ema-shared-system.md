# Shared EMA data ownership

The app tiles are work areas, not independent address books, calendars, or file stores.

| Entity | Owning source | Consumers |
| --- | --- | --- |
| Correspondence contacts | Microsoft 365, including the explicitly authorized shared Ali address book | Mail, contact links, assistant search |
| Business contacts and billing details | Office organizations / contacts, company scoped | Office; read-only directory references and recipient suggestions in Mail |
| Calendar events | Microsoft 365 event copies with immutable IDs | Mail calendar, Intelligence summaries, assistant calendar reads |
| Personal tasks and reminders | `ema_reminders` | Intelligence tasks, assistant, mail-created follow-up tasks |
| Team conversation tasks | `plaud_items` | Existing team task list and Intelligence summaries |
| Project master data | Intelligence `projects` | Exposé, Smart Check, DMS, canonical project selection in Office filing |
| Original files / generated documents | Central `documents` plus `dms_document_links` | Project documents, Office, Mail, Smart Check, Exposé |
| Accounting documents and finalized snapshots | Office | Office accounting workflow; central DMS/project references |

## Common entry points

- `/calendar` -> `/mail?view=calendar`; `/microsoft` -> `/mail?view=contacts`.
- `/mail?view=tasks` -> `/tasks`. Mail's task action opens the same task page.
- New edits use the canonical Mail calendar/contact handlers. Retired Microsoft mutation routes return 410; their read adapters remain for compatibility and assistant access.
- A contact directory response contains source references, not a copy of billing data. Merge matching email addresses for display and keep business editing in Office. Do not merge or delete historical organizations based only on an email address or name.
- Personal event title metadata is applied in calendar summaries and assistant reads as well as in Mail.

## Documents and project references

Project documents always resolve central document links, independently of the Mail feature flag. Opening a linked original uses its recorded storage bucket and the current user's authorized record.

Office filing can choose an existing canonical Intelligence project. It adds an idempotent `project` link to the same DMS document; it does not create another project or upload another original. Office's pre-existing financial project IDs remain intact. Existing unrelated project/company records are not automatically merged.

Project uploads and generated CapEx/Data Center files use the central `ema-dms` bucket. The server calculates the checksum from the stored bytes; existing matching originals are linked to the project rather than registered again. The compatibility adapter still reads legacy project storage.

Smart Check can reuse a SHA-256-matching original from any allowed owner-scoped central bucket. It validates the content and checksum again and requires an authorized project link for cross-project use. Reports remain distinct versioned outputs.

## Device calendar migration

New calendar events are not written to browser-only storage. Existing `ema-calendar-events-v1` data is preserved. The calendar shows an import action only on a device that has older valid records. The user selects which records belong to them. Imported events have no attendees and carry a persistent source marker plus a deterministic transaction ID. Successful import IDs are recorded per user; retries look up the existing Microsoft event before attempting a create. Failed imports do not remove device originals.

## Freshness and permissions

`ema:data-changed` and `BroadcastChannel("ema-data-v1")` carry invalidation signals only, never contact, invoice or document contents. Same-origin app tabs refresh their authorized sources. Focus/visibility refresh covers navigation and separate origins; there is no claim of cross-origin realtime delivery.

Office endpoints require a current Office session and company permissions. Microsoft sharing, MFA, Supabase ownership/RLS and private file access remain enforced. No credentials or privileged service keys move into a browser.

## Verification

Behavioral tests cover source reference merging, canonical navigation, legacy-import retries, owner/company boundaries, central storage resolution, Office project links without copying originals, and shared Smart Check originals. Live database inspection confirms Office documents already exist in the central Intelligence DMS. Authenticated Microsoft/Office end-to-end checks require the respective signed-in sessions; automated fixtures do not substitute for those checks.
