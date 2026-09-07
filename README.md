# Reveal Game v21 — Shareable Game

เกมเปิดป้ายภาพ 3×3 แนว Cute Arcade

Production ปัจจุบัน: `https://reveal-game.vercel.app`

> Release branch: `v21-shareable-game`
>
> v21 จะยังไม่ promote ขึ้น `main` จนกว่า Cloudflare deploy และ live API health gate จะผ่าน

## เป้าหมาย v21

v20.6 เก็บเกมไว้ใน IndexedDB ของเครื่องคนสร้างเท่านั้น ส่วน v21 เพิ่มการ Publish ขึ้น Cloud เพื่อให้ส่งลิงก์แล้วคนอื่นเห็นและเล่นเกมชุดเดียวกันได้จากอีกเครื่อง

```text
Setup Builder
   ├─ IndexedDB = Draft / Offline / Local autosave
   └─ Publish
        ↓
Cloudflare Worker — reveal-game-share-api
   ├─ D1 = game / question / answer / order / edit token hash
   └─ R2 = cropped WebP images
        ↓
Public slug
        ↓
https://reveal-game.vercel.app/game/:slug
```

## Public link vs Edit link

หลัง Publish สำเร็จ ระบบคืน 2 link:

- Public Play Link: `/game/:slug` — ส่งให้คนอื่นเล่นได้
- Private Edit Link: `/setup.html?edit=:slug#token=:editToken` — เก็บไว้กับคนสร้างเท่านั้น

Edit token ถูก hash ก่อนเก็บใน D1 และ public game endpoint ไม่คืน token ให้ Player

## Frontend

- `index.html` — Home / Player / Done
- `setup.html` — Builder + Image Editor + Publish UI + Share Modal
- `js/game.js` — local game + public shared game loading
- `js/setup.js` — builder / image editor / IndexedDB draft
- `js/storage.js` — local IndexedDB adapter
- `js/share-api.js` — v21 public/publish API client
- `js/publish.js` — publish / update / remote edit import / share modal
- `css/share.css` — publish/share UI
- `vercel.json` — public `/game/:slug` route + security headers

## Backend v21

Backend ถูกแยกจาก legacy Worker เพื่อไม่ชนข้อมูลเดิม:

- Worker: `cloudflare-v21/src/index.js`
- Wrangler config: `cloudflare-v21/wrangler.jsonc`
- Worker name: `reveal-game-share-api`
- D1 binding: `DB` → `reveal-game-db`
- R2 binding: `ASSETS` → `reveal-game-assets`
- Migration: `cloudflare/migrations/0004_shareable_games.sql`

### D1 tables

```text
share_games
- id
- slug (unique)
- title
- edit_token_hash
- status
- created_at
- updated_at
- published_at

share_questions
- id
- game_id
- position
- question
- answer
- asset_key
```

### R2 layout

```text
shared-games/
  {game-id}/
    {asset-uuid}.webp
```

## API contract

Worker runtime routes:

```text
GET  /api/v2/health
POST /api/v2/games
GET  /api/v2/games/:slug
PUT  /api/v2/games/:slug
GET  /api/v2/assets/:assetKey
```

Frontend contract uses same-origin prefix:

```text
/api/share/v2/*
```

Before Production release this prefix must proxy/rewrite to the deployed `reveal-game-share-api` Worker.

## Publish flow

```text
Create / Edit locally
↓
Save IndexedDB draft
↓
เผยแพร่เกม
↓
Upload manifest + cropped image blobs
↓
Worker validates payload
↓
R2 stores images
↓
D1 stores game/questions
↓
Worker returns slug + one-time edit token
↓
Share Modal
├─ Copy Public Link
└─ Copy Private Edit Link
```

Publishing an already-published local game uses the stored `slug + editToken` and performs `PUT` so the public URL stays the same.

## Remote edit flow

Opening the Private Edit Link:

```text
/setup.html?edit=:slug#token=:editToken
↓
Fetch public game metadata/images
↓
Import into IndexedDB draft
↓
Edit with the same v20.6 Image Editor
↓
Publish update with X-Edit-Token
```

The URL fragment is used for the private token so it is not sent as part of the normal HTTP request URL.

## Image Editor retained from v20.6

- Crop 1:1 for the 3×3 board
- Pan / zoom / pinch / wheel
- Non-destructive source image storage
- Re-edit after reload
- WebP image pipeline and size guards

Only the final cropped `imageBlob` is uploaded as the public R2 asset.

## Cloudflare deployment

Workflow: `.github/workflows/cloudflare-v21.yml`

Required GitHub Actions values:

```text
Secrets
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
```

Workflow does:

```text
Verify credentials
↓
Apply D1 migrations remotely
↓
Deploy reveal-game-share-api Worker
```

### Current release blocker

The v21 application code and frontend CI pass, but Cloudflare deployment is intentionally a release blocker until those repository secrets exist. Do not merge v21 to `main` while the Cloudflare workflow is red or live `/api/share/v2/health` is not 200.

## Automated QA

```bash
npm install
npm run check
npm test
```

Coverage includes:

- v20.6 Setup / Image Editor / Save / Reload / Player regression
- Publish UI state
- Publish request contract
- Public shared-game loading
- `/game/:slug` frontend route
- Remote edit import
- Share modal accessibility/focus behavior

GitHub CI on the latest v21 branch must be green before promotion.

## v21 Release Gate

All must pass:

1. `npm run check` PASS
2. Playwright PASS
3. GitHub CI PASS
4. Cloudflare v21 workflow PASS
5. D1 migration 0004 applied remotely
6. `reveal-game-share-api` deployed
7. Same-origin `/api/share/v2/health` → 200
8. Publish a real game → returns slug/edit token
9. Public `/game/:slug` opens on a clean browser/device
10. Public images load from R2 through API
11. Private edit link imports and updates the same slug
12. Vercel Preview READY
13. Fast-forward branch → `main`
14. Production `/`, `/setup.html`, `/game/:slug` and API health PASS
15. CI on `main` PASS

## Source of Truth

- `main` = current Production Source of Truth
- `v21-shareable-game` = v21 release candidate until all gates pass
- Vercel auto-deploys Git refs
- Never mark v21 COMPLETE based only on Vercel `READY`; Cloudflare + live share E2E must also pass
