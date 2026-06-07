CREATE TABLE IF NOT EXISTS ep_assessments (
  id uuid PRIMARY KEY,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  participant_name text NOT NULL DEFAULT 'Ankur Dhanuka',
  voice_profile text NOT NULL DEFAULT 'unspecified',
  source_kind text NOT NULL DEFAULT 'upload',
  file_name text,
  file_type text,
  file_size_bytes bigint,
  video_bucket text,
  video_path text,
  video_uploaded_at timestamptz,
  duration_seconds numeric(8, 2),
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  summary text NOT NULL
);

ALTER TABLE ep_assessments
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE ep_assessments
  DROP CONSTRAINT IF EXISTS ep_assessments_user_id_fkey;

ALTER TABLE ep_assessments
  ADD COLUMN IF NOT EXISTS video_bucket text;

ALTER TABLE ep_assessments
  ADD COLUMN IF NOT EXISTS video_path text;

ALTER TABLE ep_assessments
  ADD COLUMN IF NOT EXISTS video_uploaded_at timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ep-user-videos',
  'ep-user-videos',
  false,
  524288000,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ep_user_videos_select_own_folder'
  ) THEN
    CREATE POLICY ep_user_videos_select_own_folder
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'ep-user-videos'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ep_user_videos_insert_own_folder'
  ) THEN
    CREATE POLICY ep_user_videos_insert_own_folder
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'ep-user-videos'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ep_user_videos_update_own_folder'
  ) THEN
    CREATE POLICY ep_user_videos_update_own_folder
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'ep-user-videos'
        AND auth.uid()::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'ep-user-videos'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'ep_user_videos_delete_own_folder'
  ) THEN
    CREATE POLICY ep_user_videos_delete_own_folder
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'ep-user-videos'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ep_bucket_scores (
  assessment_id uuid NOT NULL REFERENCES ep_assessments(id) ON DELETE CASCADE,
  bucket_name text NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  description text NOT NULL,
  PRIMARY KEY (assessment_id, bucket_name)
);

CREATE TABLE IF NOT EXISTS ep_parameter_scores (
  assessment_id uuid NOT NULL REFERENCES ep_assessments(id) ON DELETE CASCADE,
  parameter_id text NOT NULL,
  bucket_name text NOT NULL,
  parameter_name text NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  metric text NOT NULL,
  reference_text text NOT NULL,
  coaching_text text NOT NULL,
  PRIMARY KEY (assessment_id, parameter_id)
);

CREATE INDEX IF NOT EXISTS ep_assessments_created_at_idx
  ON ep_assessments (created_at DESC);

CREATE INDEX IF NOT EXISTS ep_assessments_user_created_idx
  ON ep_assessments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ep_parameter_scores_bucket_idx
  ON ep_parameter_scores (bucket_name);

ALTER TABLE ep_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ep_assessments'
      AND policyname = 'ep_assessments_select_own_rows'
  ) THEN
    CREATE POLICY ep_assessments_select_own_rows
      ON ep_assessments
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
