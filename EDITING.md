# สร้าง แก้ และแชร์เกม — Reveal Game v21

## สร้างเกมในเครื่อง

เปิดหน้า Setup:

`https://reveal-game.vercel.app/setup.html`

Flow:

1. ตั้งชื่อเกม
2. อัปโหลดรูป
3. จัดรูปใน Image Editor
4. ลาก / Zoom / Crop 1:1
5. กด **ใช้รูปนี้**
6. ใส่คำเฉลย
7. แก้คำถามได้ถ้าอยาก
8. เพิ่มได้สูงสุด 10 ข้อ
9. กด **เก็บไว้ก่อน** เพื่อ Save Draft ลง IndexedDB
10. กด **ลุยเลย** เพื่อทดสอบเกมในเครื่อง

Draft ยังทำงานเหมือน v20.6 และไม่ต้องมี Cloud เพื่อสร้าง/ทดลองเกม

## เผยแพร่ให้คนอื่นเล่น

เมื่อทุกข้อพร้อมและ Cloud status พร้อมใช้งาน:

1. กด **เผยแพร่เกม**
2. ระบบ Save Draft ก่อน
3. รูป Crop แล้วถูก Upload ไป R2
4. ชื่อเกม / คำถาม / เฉลย / ลำดับ ถูก Save ใน D1
5. ระบบสร้าง Public slug
6. Share Modal แสดง 2 links

### Public Play Link

ตัวอย่าง:

`https://reveal-game.vercel.app/game/abc123xyz`

ส่งลิงก์นี้ให้คนอื่นได้ ทุกเครื่องจะโหลดเกมเดียวกันจาก Cloud

### Private Edit Link

รูปแบบ:

`https://reveal-game.vercel.app/setup.html?edit=abc123xyz#token=PRIVATE_TOKEN`

ลิงก์นี้ **ห้ามส่งให้ผู้เล่นทั่วไป** เพราะคนที่มี token สามารถ Publish ทับเกมเดิมได้

## กลับมาแก้เกมที่ Publish แล้ว

เปิด Private Edit Link

ระบบจะ:

```text
Fetch game จาก Cloud
↓
โหลดรูป public
↓
Import เป็น IndexedDB Draft
↓
เปิดใน Setup Builder
```

แก้ข้อความหรือภาพได้ตามปกติ แล้วกด **เผยแพร่เกม** อีกครั้ง ระบบจะ Update slug เดิม ไม่สร้าง Public Link ใหม่

## Image Editor

ทำได้:

- ลากรูปเพื่อจัดตำแหน่ง
- Slider / − / + สำหรับ Zoom
- Pinch 2 นิ้วบนมือถือ
- Mouse wheel บน Desktop
- Reset กลับกึ่งกลาง
- Crop 1:1 ตรงกับบอร์ด 3×3
- Re-edit ภายหลังแบบ non-destructive

กด **ไม่เอาละ** หรือ Escape = ไม่ Apply

กด **ใช้รูปนี้** = Apply แต่ยังต้อง Save Draft หรือ Publish ต่อ

## Local vs Cloud

```text
IndexedDB
= Draft / Offline / แก้ในเครื่อง

D1 + R2
= Published version / Share link / Cross-device
```

ดังนั้น:

- ยังไม่ Publish → คนอื่นมองไม่เห็น
- Publish แล้ว → Public Link ใช้ได้ข้ามเครื่อง
- แก้ Draft หลัง Publish แต่ยังไม่ Publish ใหม่ → ผู้เล่นยังเห็น version เดิมบน Cloud

## Developer files

Frontend:

- `js/setup.js` — Builder + Image Editor
- `js/storage.js` — IndexedDB
- `js/share-api.js` — Share API client
- `js/publish.js` — Publish / Update / Share / Remote Edit
- `js/game.js` — Player + public slug loading
- `css/share.css` — Share UI
- `vercel.json` — `/game/:slug` routing

Backend:

- `cloudflare-v21/src/index.js` — Share Worker
- `cloudflare-v21/wrangler.jsonc` — D1/R2 bindings
- `cloudflare/migrations/0004_shareable_games.sql` — v21 share tables
- `.github/workflows/cloudflare-v21.yml` — remote migration + Worker deploy

## API

Worker:

```text
GET  /api/v2/health
POST /api/v2/games
GET  /api/v2/games/:slug
PUT  /api/v2/games/:slug
GET  /api/v2/assets/:assetKey
```

Frontend expects:

`/api/share/v2/*`

ก่อน release ต้องมี same-origin proxy/rewrite ไปยัง Worker ที่ deploy แล้ว

## QA ก่อน v21 Release

```bash
npm install
npm run check
npm test
```

และต้องผ่าน live gate:

```text
Cloudflare deploy PASS
→ API health 200
→ Publish real game
→ เปิด Public Link จาก clean browser
→ รูป R2 โหลดครบ
→ เปิด Private Edit Link
→ แก้ + Publish update
→ Public slug เดิมแสดง version ใหม่
```

ห้ามถือว่า v21 COMPLETE ถ้า frontend test ผ่านแต่ Cloudflare workflow ยังแดง
