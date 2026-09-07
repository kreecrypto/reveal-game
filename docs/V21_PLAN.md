# Reveal Game v21 — Shareable Game

Goal: turn local-only games into shareable published games.

- IndexedDB stays the draft/offline source.
- Cloudflare Worker + D1 + R2 stores published games.
- Public route: `/game/:slug`.
- Publish returns a private edit token to the creator; only a hash is stored server-side.
- v21 publish API uses multipart form-data with JSON metadata + cropped WebP images.

Implementation branch: `v21-shareable-game`.
