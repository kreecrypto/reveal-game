# Reveal Game v20.5

เกมเปิดป้ายภาพ 3×3 แนว Cute Arcade

Production: `https://reveal-game.vercel.app`

## Source of Truth

GitHub repo: `kreecrypto/reveal-game`

- `main` = Production source of truth
- Vercel deploy frontend อัตโนมัติจาก `main`
- ห้ามแก้ Production สดโดยไม่ผ่าน GitHub

## Architecture ที่ใช้งานจริงใน v20.5

```text
Player / Game Setup
        ↓
Vercel Static Frontend
        ↓
Browser IndexedDB
        ├─ game title
        ├─ questions
        ├─ answers
        └─ uploaded image blobs

Fallback demo
        ↓
data/questions.json
```

### Frontend

- `index.html` = หน้าเล่นเกม
- `setup.html` = หน้า Game Setup Builder
- `css/game.css` = Design tokens + shared game UI
- `css/setup.css` = Setup-only UI
- `js/game.js` = player state / reveal flow
- `js/setup.js` = builder / validation / image processing / dirty-state protection
- `js/storage.js` = IndexedDB adapter
- `data/questions.json` = demo fallback

## Game Setup

ผู้ใช้สามารถ:

- ตั้งชื่อเกม
- อัปโหลดรูป 1–10 ข้อ
- ใส่คำเฉลย
- แก้คำถาม
- เพิ่ม / ลบ / Undo ข้อ
- Save ลง IndexedDB
- เริ่มเล่นทันที

ข้อมูลใน v20.5 เป็น **local to browser/device** ยังไม่ sync ข้ามเครื่อง

## Image pipeline

ทุกภาพที่ Upload จะผ่าน:

```text
Decode → Resize (max 1600px) → Re-encode WebP → Size guard → IndexedDB
```

- Source file สูงสุด 15MB
- เป้าหมายหลังบีบอัดประมาณ ≤2.5MB
- Hard limit หลังบีบอัด 4MB

## Unsaved-change protection

หน้า Setup มี dirty-state guard:

- เตือนเมื่อกดกลับหน้าเกมทั้งที่ยังไม่ได้ Save
- เตือน browser เมื่อ refresh / ปิดแท็บ
- Save / Restore / Clear สำเร็จแล้วจะ reset dirty state

## Automated QA

Root project มี Playwright smoke tests

```bash
npm install
npm run check
npm test
```

ครอบคลุมอย่างน้อย:

- Setup → Upload + Answer → Save
- Reload → ข้อมูลยังอยู่
- Start Game → เปิดป้าย → Reveal
- Unsaved-change modal
- Delete → Undo

GitHub Actions workflow: `.github/workflows/ci.yml`

## Security headers

`vercel.json` กำหนด:

- CSP
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- Referrer Policy
- Permissions Policy

## Cloudflare folder

`cloudflare/` เป็น **future/dormant backend** สำหรับ phase ที่ต้องการ:

- แชร์เกมข้ามเครื่อง
- D1 database
- R2 image storage
- public game links

**v20.5 frontend ยังไม่ได้เรียก Cloudflare API ใน runtime**

อย่า deploy หรือถือ `cloudflare/` เป็น production dependency ของ v20.5 จนกว่าจะมี release plan สำหรับ backend โดยตรง

## Release rule

ก่อนปิด release:

1. `npm run check` ผ่าน
2. Playwright ผ่าน
3. GitHub CI ผ่าน
4. Vercel Production = READY
5. Production `/` และ `/setup.html` ตอบ 200
6. ไม่มี P0/P1 regression blocker
