# Executive Presence Assessment Demo

This is a local browser demo built from the Executive Presence specification files.

## Run

```sh
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

## What is included

- Recording prompt and video validation for MP4/MOV, 500 MB max, 2:00-4:00 duration.
- Upload, camera, and demo-sample entry points.
- Simulated async processing stages.
- Deterministic local scoring for all 21 PRD parameters.
- Bucket dashboard and two-sentence coaching guidance per parameter.

The demo does not upload media or call AI services. It keeps everything in the browser.
