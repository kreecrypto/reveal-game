# v21 Release Status

Frontend and Worker code are release-candidate complete.

Validated on the release branch:

- Syntax check: PASS
- Wrangler dry run: PASS
- Cloudflare Dashboard wrapper dry run: PASS
- Playwright browser tests: PASS
- Vercel preview: READY
- IndexedDB remains the local draft store
- Publish/share UI, public slug route, edit-token flow, D1 schema, and R2 asset flow are implemented

Cloudflare Dashboard build settings were updated on 2026-09-07 and a fresh v21 branch build was triggered for verification. Release remains blocked until `Workers Builds: reveal-game` is green and live Worker health succeeds.
