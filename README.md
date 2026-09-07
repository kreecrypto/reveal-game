# Reveal Game v21 — Shareable Game

เกมเปิดป้ายภาพ 3×3 แนว Cute Arcade

Production ปัจจุบัน: `https://reveal-game.vercel.app`

> Release branch: `v21-shareable-game`
>
> v21 จะ promote ขึ้น `main` เมื่อ GitHub CI + Supabase live share E2E ผ่านครบ

## Architecture v21

v20.6 เก็บเกมไว้ใน IndexedDB ของเครื่องคนสร้างเท่านั้น ส่วน v21 เพิ่ม Publish/Share ให้คนอื่นเปิดลิงก์จากอีกเครื่องได้

```text
Vercel Frontend
   ├─ IndexedDB = Draft / Offline / Local autosave
   └─ Publish / Read shared game
        ↓
Supabase
   ├─ Data API + PostgreSQL RLS = game metadata / edit-token authorization
   └─ Storage = public game images
        ↓
Public slug
        ↓
https://reveal-game.vercel.app/game/:slug
```

ไม่มี Cloudflare Worker, D1, R2 หรือ Vercel share proxy ใน runtime path ของ v21 อีกต่อไป

## Public link vs Edit link

หลัง Publish สำเร็จ ระบบคืน 2 link:

- Public Play Link: `/game/:slug` — ส่งให้คนอื่นเล่นได้
- Private Edit Link: `/setup.html?edit=:slug#token=:editToken` — เก็บไว้กับคนสร้างเท่านั้น

Edit token ถูก SHA-256 ก่อนเก็บใน PostgreSQL และตัว token จริงอยู่ใน URL fragment จึงไม่ถูกส่งไปกับ request URL ตามปกติ

## Supabase resources

Project ref: `xhqrfovpsoccocakjxfk`

### Database

`public.reveal_games`

```text
id
slug (unique)
title
edit_token_hash
manifest (JSONB)
status: draft | published | archived
created_at
updated_at
published_at
```

เกมที่เผยแพร่ใช้ RPC `reveal_get_game(slug)` เพื่ออ่านทีละ slug แบบ unlisted link แทนการเปิดให้ anon list ตารางทั้งหมด

### Storage

Bucket: `reveal-game-assets`

```text
shared-games/
  {slug}/
    {asset-uuid}.{ext}
```

Bucket เป็น public-read สำหรับภาพที่แชร์ ส่วน insert/update/delete ถูก RLS ตรวจด้วย `X-Edit-Token` และ slug ของเกม

## Security model

- Browser ใช้ Supabase Publishable Key เท่านั้น
- ไม่มี `service_role` / secret key อยู่ใน frontend
- `public.reveal_games` เปิด RLS
- Insert ทำได้เฉพาะ `draft`
- Publish/update ต้องผ่าน `X-Edit-Token`
- Token hash ตรวจใน PostgreSQL ผ่าน `reveal_token_matches(slug)`
- Public player อ่านเกมผ่าน `reveal_get_game(slug)` เท่านั้น
- รูปจำกัด 3 MB/ไฟล์, สูงสุด 10 ข้อ และรวมสูงสุด 20 MB ต่อ publish

## Frontend

- `index.html` — Home / Player / Done
- `setup.html` — Builder + Image Editor + Publish UI + Share Modal
- `js/game.js` — local game + public shared game loading
- `js/setup.js` — builder / image editor / IndexedDB draft
- `js/storage.js` — local IndexedDB adapter
- `js/share-api.js` — direct Supabase Data API + Storage client
- `js/publish.js` — publish / update / remote edit import / share modal
- `css/share.css` — publish/share UI
- `vercel.json` — `/game/:slug` route + CSP allowing the Supabase project origin

## Publish flow

```text
Create / Edit locally
↓
Save IndexedDB draft
↓
เผยแพร่เกม
↓
Create reveal_games row as draft
↓
Upload cropped image blobs to Supabase Storage
↓
PATCH manifest + status=published using X-Edit-Token
↓
Share Modal
├─ Copy Public Link
└─ Copy Private Edit Link
```

Publishing an already-published local game keeps the same slug, uploads a fresh asset set, switches the manifest only after upload completes, then cleans old assets best-effort.

## Remote edit flow

```text
/setup.html?edit=:slug#token=:editToken
↓
Fetch published game via reveal_get_game
↓
Import images into IndexedDB draft
↓
Edit with the existing Image Editor
↓
Publish update with X-Edit-Token
```

## Image Editor retained from v20.6

- Crop 1:1 for the 3×3 board
- Pan / zoom / pinch / wheel
- Non-destructive source image storage
- Re-edit after reload
- WebP/image size guards

## Automated QA

```bash
npm install
npm run check
npm test
```

Coverage includes:

- Setup / Image Editor / Save / Reload / Player regression
- Supabase share health
- Draft → Storage upload → published manifest contract
- Public shared-game loading
- `/game/:slug` frontend route
- Remote edit import
- Share modal accessibility/focus behavior

## v21 Release Gate

All must pass:

1. `npm run check` PASS
2. Playwright PASS
3. GitHub CI PASS
4. Supabase `reveal_share_health()` PASS
5. Real publish creates `reveal_games` row
6. Real publish uploads images to `reveal-game-assets`
7. `/game/:slug` loads from a second session/device
8. Private edit link can update the same slug
9. Vercel Preview live QA PASS
10. Only then promote v21 to Production
