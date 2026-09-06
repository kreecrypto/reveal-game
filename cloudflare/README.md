# Cloudflare backend

Planned resources:
- Worker: `reveal-game-api`
- D1: `reveal-game-db`
- R2: `reveal-game-assets`

## Setup once Cloudflare access is available
1. Create D1 database `reveal-game-db`.
2. Replace `REPLACE_AFTER_CREATE` in `wrangler.jsonc` with the real database id.
3. Create R2 bucket `reveal-game-assets`.
4. Apply `migrations/0001_init.sql`.
5. Deploy Worker.
6. Verify `GET /health` and `GET /games`.
