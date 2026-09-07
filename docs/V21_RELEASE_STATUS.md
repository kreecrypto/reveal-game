# v21 Release Status

Frontend and Worker code are release-candidate complete.

Validated on the release branch:

- Syntax check: PASS
- Wrangler dry run: PASS
- Playwright browser tests: PASS
- Vercel preview: READY
- IndexedDB remains the local draft store
- Publish/share UI, public slug route, edit-token flow, D1 schema, and R2 asset flow are implemented

Cloudflare Workers Build connected to the repository is still reporting a build failure from its dashboard configuration. The application degrades safely: local create/edit/play continues to work and Publish remains disabled until Worker health succeeds.
