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

Set `DATABASE_URL` in `.env` to your Supabase Postgres connection string before starting the app. The server creates these tables automatically on startup:

- `ep_users`
- `ep_auth_sessions`
- `ep_assessments`
- `ep_bucket_scores`
- `ep_parameter_scores`

The app opens on a public landing page. Users can create an account or sign in; authenticated sessions are stored in HttpOnly cookies and assessment APIs require a valid session.

## What is included

- Professional landing page and account-based access layer.
- Recording prompt and video validation for MP4/MOV, 500 MB max, 2:00-4:00 duration.
- Upload, camera, and demo-sample entry points.
- Simulated async processing stages.
- Deterministic local scoring for all 21 PRD parameters.
- Bucket dashboard and two-sentence coaching guidance per parameter.
- Supabase Postgres persistence for completed assessment reports.

The demo does not upload media or call AI services. It stores report data in Postgres, while uploaded video files remain local to the browser.
