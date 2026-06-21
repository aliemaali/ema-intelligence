-- ============================================================
-- EMA Intelligence – Storage Buckets Migration
-- Version: 1.0.0
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  FALSE,  -- Private bucket
  52428800,  -- 50MB limit per file
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Only authenticated user (owner) can read/write their own files
-- Files are stored as: {user_id}/{project_id}/{filename}

CREATE POLICY "documents_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-documents'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-documents'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-documents'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-documents'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );
