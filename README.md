# Reveal Game

เกมเปิดป้ายภาพแนว Cute Arcade

## โครงสร้างหลักของโปรเจกต์

ให้จำง่ายๆ แบบนี้:

**Vercel → GitHub → Cloudflare**

แต่แต่ละตัวมีหน้าที่ต่างกัน:

### 1. Vercel = หน้าเว็บที่ผู้เล่นเปิด

URL Production:

`https://reveal-game.vercel.app`

Vercel รับโค้ด Frontend จาก GitHub branch `main` แล้ว deploy ให้อัตโนมัติ

### 2. GitHub = Source of Truth

Repo หลัก:

`kreecrypto/reveal-game`

ทุกอย่างต้องเริ่มจาก GitHub ก่อน เช่น

- หน้าเกม `index.html`
- ตั้งค่า Vercel `vercel.json`
- Backend Cloudflare `cloudflare/`
- Database migrations

กฎสำคัญ: **ห้ามแก้ Production สดโดยไม่ผ่าน GitHub**

### 3. Cloudflare = Backend ของเกม

Cloudflare ใช้แยกเป็น 3 ส่วน:

- Worker `reveal-game-api` = API
- D1 `reveal-game-db` = Database
- R2 `reveal-game-assets` = รูปเกม

Frontend บน Vercel จะเรียก API ของ Cloudflare Worker โดยตรง

## Flow ตอนผู้เล่นใช้งาน

```text
ผู้เล่น
  ↓
Vercel Frontend
  ↓ API
Cloudflare Worker
  ├─ D1 Database
  └─ R2 Assets
```

## Flow ตอนเราแก้ระบบ

```text
แก้โค้ด
  ↓
GitHub main
  ├─ Frontend เปลี่ยน → Vercel Auto Deploy
  └─ cloudflare/** เปลี่ยน → Cloudflare Workers Builds Auto Deploy
```

## สถานะตอนนี้

- GitHub repo: พร้อม
- Vercel ↔ GitHub: เชื่อมแล้ว
- Vercel Production: Auto Deploy จาก `main` แล้ว
- Cloudflare Backend code: พร้อมใน `cloudflare/`
- Cloudflare D1/R2: ต้องสร้าง resource จริงใน Cloudflare account ก่อน
- Cloudflare Workers Builds: ยังต้องเชื่อม repo `kreecrypto/reveal-game`

## GitHub → Vercel

เชื่อมแล้ว โดยใช้:

- Repo: `kreecrypto/reveal-game`
- Production Branch: `main`
- Root Directory: `./`

หลังจากนี้ทุก commit ที่ `main` จะทำให้ Vercel deploy ใหม่อัตโนมัติ

## GitHub → Cloudflare

ตอนเชื่อม Cloudflare Workers Builds ให้ใช้:

- Repository: `kreecrypto/reveal-game`
- Production branch: `main`
- Root directory: `cloudflare`
- Worker name: `reveal-game-api`
- Deploy command: `npx wrangler deploy`

ก่อน deploy ต้องมี:

- D1: `reveal-game-db`
- R2: `reveal-game-assets`
- D1 `database_id` จริงใน `cloudflare/wrangler.jsonc`

## ไฟล์สำคัญ

- `index.html` = หน้าเกมหลัก
- `vercel.json` = Vercel config
- `cloudflare/wrangler.jsonc` = Cloudflare bindings/config
- `cloudflare/src/index.js` = Worker API
- `cloudflare/migrations/` = Database schema
- `cloudflare/README.md` = คู่มือ Backend แบบละเอียด

## กฎของโปรเจกต์

- GitHub `main` คือ Source of Truth
- Frontend deploy ผ่าน GitHub → Vercel เท่านั้น
- Backend deploy ผ่าน GitHub → Cloudflare เท่านั้น
- ก่อนปล่อย Production ต้องตรวจของจริง
- ถ้าพัง ให้ rollback commit/deployment แทนการแก้สดบน Production
