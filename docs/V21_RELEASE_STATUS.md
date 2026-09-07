# v21 Release Status

v21 is the Production release line.

Current architecture:

- Vercel frontend
- Supabase Database + Storage for share/publish
- IndexedDB for local drafts
- Public slug links for play
- Private edit-token links for updates

Validated release gates:

- Syntax check: PASS
- Playwright browser tests: PASS
- Real Supabase browser E2E: PASS
- Publish → Storage → public play → private edit/update: PASS
- RLS/edit-token flow: PASS
- Test data and storage cleanup: PASS

UX cleanup completed on 2026-09-07:

- Removed redundant hero/helper copy
- Removed duplicate progress/readiness text
- Simplified Builder labels and CTAs
- Removed backend/technical wording from user-facing screens
- Simplified image editor and share modal copy
- Removed visible version badges
- Updated browser tests to the new concise labels

Latest browser CI after the UX cleanup: PASS.
