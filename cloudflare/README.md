# Cloudflare Backend — Reveal Game

Backend ของเกมใช้ Cloudflare แยกหน้าที่ดังนี้

- **Worker `reveal-game-api`** = รับ API จากหน้าเว็บ
- **D1 `reveal-game-db`** = เก็บเกม รอบ คะแนน และ Session
- **R2 `reveal-game-assets`** = เก็บรูปเกม

## ภาพรวมการทำงาน

หน้าเว็บบน Vercel จะไม่คำนวณคะแนนเองอีกต่อไป

1. ผู้เล่นเปิดป้าย
2. Frontend ส่งข้อมูลไป Worker
3. Worker บันทึกลง D1
4. ผู้เล่นตอบคำถาม
5. Worker ตรวจคำตอบจากฐานข้อมูล
6. Worker คำนวณคะแนนแล้วส่งผลกลับ Frontend

สูตรคะแนนปัจจุบัน

`1000 - (ป้ายที่เปิด × 50) - (ตอบผิด × 100) - (ใช้ Hint ? 150 : 0)`

คะแนนต่ำสุดคือ `0`

## API ที่มีแล้ว

- `GET /health`
- `GET /api/v1/health`
- `GET /api/v1/games`
- `GET /api/v1/games/:gameId`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/:sessionId`
- `POST /api/v1/sessions/:sessionId/rounds/:roundId/open`
- `POST /api/v1/sessions/:sessionId/rounds/:roundId/hint`
- `POST /api/v1/sessions/:sessionId/rounds/:roundId/guess`
- `POST /api/v1/sessions/:sessionId/rounds/:roundId/reveal`
- `POST /api/v1/sessions/:sessionId/complete`
- `GET /api/v1/assets/:key`
- `PUT /api/v1/admin/assets/:key` ต้องใช้ `X-Admin-Token`

## สร้าง Cloudflare ครั้งแรก

เข้าโฟลเดอร์นี้ก่อน

```bash
cd cloudflare
npm install
npx wrangler login
```

### 1. สร้าง D1

```bash
npx wrangler d1 create reveal-game-db --location=apac
```

Cloudflare จะคืนค่า `database_id` กลับมา

นำค่านั้นไปแทน

```text
REPLACE_AFTER_CREATE
```

ในไฟล์ `wrangler.jsonc`

Cloudflare รองรับ `apac` เป็น location hint สำหรับ Asia-Pacific. D1 ID ที่ได้จาก `d1 create` เป็นค่าที่ต้องใช้ใน Worker binding.

### 2. สร้าง R2

```bash
npx wrangler r2 bucket create reveal-game-assets
```

R2 bucket จะยังเป็น private โดย default และ Worker จะเข้าถึงผ่าน binding `ASSETS`

### 3. Apply Database Migrations

```bash
npm run db:migrate:prod
```

คำสั่งนี้จะรัน migration ตามลำดับ

- `0001_init.sql` — games / rounds / sessions
- `0002_gameplay_state.sql` — opened tiles / wrong answer / hint / round score
- `0003_seed_demo.sql` — Demo game 3 รอบ

### 4. ตั้ง Admin Secret

ใช้สำหรับ upload asset เข้า R2

```bash
npx wrangler secret put ADMIN_TOKEN
```

อย่าใส่ token จริงลง GitHub

### 5. Deploy Worker

```bash
npm run deploy
```

หลัง deploy จะได้ URL ลักษณะนี้

```text
https://reveal-game-api.<account-subdomain>.workers.dev
```

## ตรวจว่า Backend ใช้งานได้

เปิด

```text
https://<worker-url>/health
```

ควรได้

```json
{
  "ok": true,
  "service": "reveal-game-api",
  "version": "v1"
}
```

แล้วตรวจ

```text
GET /api/v1/games
```

ควรเห็นเกม `cute-arcade-demo`

## CORS

Production อนุญาต

```text
https://reveal-game.vercel.app
```

และ local dev ปัจจุบันอนุญาต

```text
http://localhost:3000
http://127.0.0.1:5500
```

ค่าพวกนี้อยู่ใน `ALLOWED_ORIGINS` ของ `wrangler.jsonc`

## Source of Truth

- Backend code: `cloudflare/src/index.js`
- Database schema: `cloudflare/migrations/`
- Cloudflare config: `cloudflare/wrangler.jsonc`

อย่าแก้ Worker สดใน Cloudflare Dashboard แล้วปล่อยทิ้งไว้ เพราะ GitHub `main` ต้องเป็น Source of Truth เหมือนฝั่ง Vercel
