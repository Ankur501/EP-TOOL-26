# Executive Presence Assessment Demo

This is a local browser demo built from the Executive Presence specification files.

## Run

```sh
npm install
cp .env.example .env
npm start
```

Then open:

```text
http://127.0.0.1:4173
```

Set these values in `.env` before starting the app:

- `DATABASE_URL`: Supabase Postgres connection string for report persistence.
- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_ANON_KEY`: your Supabase anon public key for Supabase Auth.

The server creates these report tables automatically on startup:

- `ep_assessments`
- `ep_bucket_scores`
- `ep_parameter_scores`

It also creates a private Supabase Storage bucket named `ep-user-videos`. Videos are stored under the signed-in user's Supabase Auth ID, and bucket policies restrict access to that user's own folder.

The app opens on a public landing page. Users create accounts and sign in through Supabase Auth. Report APIs require a valid Supabase access token, and each user sees their own saved assessment history in the app.

For hosted auth redirects, add these callback URLs in Supabase Auth:

- `https://ep-tool-26.vercel.app/auth/callback`
- `https://ep-tool-26.vercel.app/callback`

## What is included

- Professional landing page and Supabase Auth access layer.
- Recording prompt and video validation for MP4/MOV, 500 MB max, 2:00-4:00 duration.
- Upload, camera, and demo-sample entry points.
- Supabase Storage upload for user-uploaded and camera-recorded videos.
- Simulated async processing stages.
- Deterministic local scoring for all 21 PRD parameters.
- Bucket dashboard and two-sentence coaching guidance per parameter.
- Supabase Postgres persistence for completed assessment reports.
- Per-user assessment history inside the authenticated app.

The demo does not upload media or call AI services. It stores report data in Postgres, while uploaded video files remain local to the browser.
