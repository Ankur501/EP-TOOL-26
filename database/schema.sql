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
  duration_seconds numeric(8, 2),
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  summary text NOT NULL
);

ALTER TABLE ep_assessments
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE ep_assessments
  DROP CONSTRAINT IF EXISTS ep_assessments_user_id_fkey;

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
