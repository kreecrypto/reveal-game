# Reveal Game v20.6

เกมเปิดป้ายภาพ 3×3 แนว Cute Arcade

Production: `https://reveal-game.vercel.app`

## Source of Truth

GitHub repo: `kreecrypto/reveal-game`

- `main` = Production source of truth
- Vercel deploy frontend อัตโนมัติจาก `main`
- ห้ามแก้ Production สดโดยไม่ผ่าน GitHub

## Architecture ที่ใช้งานจริงใน v20.6

```text
Player / Game Setup
        ↓
Vercel Static Frontend
        ↓
Browser IndexedDB
        ├─ game title
        ├─ questions
        ├─ answers
        ├─ edited/cropped image blobs
        ├─ compressed source image blobs
        └─ crop metadata (zoom / position)

Fallback demo
        ↓
data/questions.json
```

### Frontend

- `index.html` = หน้าเล่นเกม
- `setup.html` = หน้า Game Setup Builder + Image Editor
- `css/game.css` = Design tokens + shared game UI
- `css/setup.css` = Setup + Image Editor UI
- `js/game.js` = player state / reveal flow
- `js/setup.js` = builder / validation / image editor / image processing / dirty-state protection
- `js/storage.js` = IndexedDB adapter
- `data/questions.json` = demo fallback

## Game Setup

ผู้ใช้สามารถ:

- ตั้งชื่อเกม
- อัปโหลดรูป 1–10 ข้อ
- ใส่คำเฉลย
- แก้คำถาม
- เพิ่ม / ลบ / Undo ข้อ
- แก้ภาพก่อนเล่น
- ลากจัดตำแหน่งภาพ
- ย่อ / ขยายด้วย slider, ปุ่ม −/+, mouse wheel หรือ pinch gesture
- Crop 1:1 ให้พอดีกับบอร์ด 3×3
- Reset ภาพกลับกึ่งกลาง
- Save ลง IndexedDB
- เริ่มเล่นทันที

ข้อมูลใน v20.6 เป็น **local to browser/device** ยังไม่ sync ข้ามเครื่อง

## Image pipeline

เมื่อ Upload ภาพใหม่:

```text
Validate → Decode → Resize → Compress source WebP
        ↓
Open Image Editor
        ↓
Pan / Zoom / Crop 1:1
        ↓
Encode cropped WebP → Size guard → IndexedDB
```

ระบบเก็บ 2 อย่างเพื่อให้แก้ Crop ซ้ำได้แบบ non-destructive:

1. `sourceImageBlob` = รูปต้นทางที่บีบอัดแล้วและยังรักษาสัดส่วนเดิม
2. `imageBlob` = รูป 1:1 ที่ Crop แล้วสำหรับ Player

พร้อม `imageCrop` สำหรับเก็บ zoom / offset เพื่อเปิด Editor ครั้งถัดไปแล้วเห็น framing เดิม

Limits:

- Source file สูงสุด 15MB
- Source หลังบีบอัด target ประมาณ ≤1.8MB, hard limit 3MB
- Cropped image 1024×1024 target ประมาณ ≤1.2MB, hard limit 2.5MB

เกมเก่า v20.5 ยังเปิดได้ โดยถ้าไม่มี `sourceImageBlob` ระบบจะใช้ `imageBlob` เดิมเป็น source fallback

## Unsaved-change protection

หน้า Setup มี dirty-state guard:

- เตือนเมื่อกดกลับหน้าเกมทั้งที่ยังไม่ได้ Save
- เตือน browser เมื่อ refresh / ปิดแท็บ
- เปิด Image Editor แล้วกด Cancel จะยังไม่เปลี่ยนรูปจริง
- รูปจะถือว่าแก้แล้วเมื่อกด **ใช้รูปนี้** เท่านั้น
- Save / Restore / Clear สำเร็จแล้วจะ reset dirty state

## Accessibility

Image Editor รองรับ:

- Touch drag / pinch gesture
- Range slider สำหรับ keyboard
- ปุ่ม − / + ขนาด touch target 44px
- Focus trap ภายใน modal
- Escape เพื่อปิดโดยไม่ Apply
- Focus visible

## Automated QA

Root project มี Playwright smoke/regression tests

```bash
npm install
npm run check
npm test
```

ครอบคลุมอย่างน้อย:

- Setup → Upload → Image Editor → Apply → Answer → Save
- Reload → ข้อมูลยังอยู่
- Image Editor zoom / crop metadata → Save → Re-edit
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

**v20.6 frontend ยังไม่ได้เรียก Cloudflare API ใน runtime**

อย่า deploy หรือถือ `cloudflare/` เป็น production dependency ของ v20.6 จนกว่าจะมี release plan สำหรับ backend โดยตรง

## Release rule

ก่อนปิด release:

1. `npm run check` ผ่าน
2. Playwright ผ่าน
3. GitHub CI ผ่าน
4. Vercel Production = READY
5. Production `/` และ `/setup.html` ตอบ 200
6. Image Editor flow ผ่านบน mobile/desktop
7. ไม่มี P0/P1 regression blocker
