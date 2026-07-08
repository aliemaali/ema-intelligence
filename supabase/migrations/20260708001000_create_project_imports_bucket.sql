-- EMA Intelligence – Project import storage bucket
-- Private bucket for uploaded Exposés, screenshots, photos, Word and Excel files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-imports',
  'project-imports',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
