# Cloudflare Backend — Reveal Game

Backend ใช้ Cloudflare 3 ส่วน

- **Worker `reveal-game-api`** = API ของเกม
- **D1 `reveal-game-db`** = เก็บเกม / รอบ / Session / คะแนน
- **R2 `reveal-game-assets`** = เก็บรูปเกม

## เข้าใจง่ายๆ

Frontend อยู่บน Vercel

```text
ผู้เล่น
  ↓
Vercel Frontend
  ↓ API
Cloudflare Worker
  ├─ D1 = ข้อมูลเกมและคะแนน
  └─ R2 = รูปเกม
```

คะแนนจะคำนวณที่ Backend ไม่ใช่ Browser

```text
1000
- เปิดป้าย 50 ต่อป้าย
- ตอบผิด 100 ต่อครั้ง
- ใช้ Hint 150
```

ต่ำสุด = 0

---

# สถานะตอนนี้

## ทำแล้ว

- Worker API v1
- D1 schema
- Session state
- เปิดป้าย
- Hint
- ตรวจคำตอบฝั่ง Server
- Reveal
- Complete session
- R2 read/upload API
- CORS สำหรับ `https://reveal-game.vercel.app`
- Demo game 3 รอบ

## ยังต้องทำใน Cloudflare Dashboard 1 ครั้ง

1. สร้าง D1
2. สร้าง R2
3. ใส่ D1 Database ID ใน `wrangler.jsonc`
4. Import GitHub repo เข้า Workers Builds
5. ตั้ง `ADMIN_TOKEN`

หลังจากนี้ GitHub `main` จะเป็น Source of Truth และ Cloudflare deploy อัตโนมัติ

---

# วิธี Setup แบบง่ายที่สุด

## Step 1 — สร้าง D1

เปิด Cloudflare Dashboard

ไปที่

```text
Storage & Databases
→ D1 SQL Database
→ Create database
```

ตั้งชื่อ

```text
reveal-game-db
```

ถ้ามีตัวเลือก Location ให้เลือก Asia-Pacific / APAC

หลังสร้างแล้ว ให้ Copy ค่า **Database ID**

ใน GitHub เปิด

```text
cloudflare/wrangler.jsonc
```

แทนค่า

```text
REPLACE_AFTER_CREATE
```

ด้วย Database ID จริง

---

## Step 2 — สร้าง R2

ใน Cloudflare Dashboard ไปที่

```text
R2 Object Storage
→ Create bucket
```

ตั้งชื่อ

```text
reveal-game-assets
```

ไม่ต้องเปิด Public Bucket เพราะรูปจะอ่านผ่าน Worker API

---

## Step 3 — เชื่อม GitHub กับ Cloudflare Worker

ไปที่

```text
Workers & Pages
→ Create application
→ Import a repository
```

เลือก GitHub repo

```text
kreecrypto/reveal-game
```

ตั้งค่า

```text
Worker name: reveal-game-api
Production branch: main
Root directory: cloudflare
Build command: เว้นว่าง
Deploy command: npx wrangler d1 migrations apply reveal-game-db --remote && npx wrangler deploy
```

ชื่อ Worker ต้องตรงกับ

```json
"name": "reveal-game-api"
```

ใน `wrangler.jsonc`

จากนั้นกด Save and Deploy

---

## Step 4 — ตั้ง Admin Secret

หลัง Worker ถูกสร้างแล้ว ไปที่ Worker

```text
Settings
→ Variables and Secrets
→ Add
```

ชื่อ

```text
ADMIN_TOKEN
```

ชนิด

```text
Secret
```

ค่าให้ใช้รหัสยาวแบบสุ่ม และห้าม commit ลง GitHub

Secret นี้ใช้เฉพาะ API upload asset เข้า R2

---

# ตรวจว่า Backend ใช้งานได้

หลัง deploy Cloudflare จะให้ URL ประมาณ

```text
https://reveal-game-api.<your-subdomain>.workers.dev
```

เปิด

```text
/health
```

ต้องได้ประมาณนี้

```json
{
  "ok": true,
  "service": "reveal-game-api",
  "version": "v1"
}
```

จากนั้นเปิด

```text
/api/v1/games
```

ต้องเห็น

```text
cute-arcade-demo
```

---

# API หลัก

```text
GET  /health
GET  /api/v1/games
GET  /api/v1/games/:gameId
POST /api/v1/sessions
GET  /api/v1/sessions/:sessionId
POST /api/v1/sessions/:sessionId/rounds/:roundId/open
POST /api/v1/sessions/:sessionId/rounds/:roundId/hint
POST /api/v1/sessions/:sessionId/rounds/:roundId/guess
POST /api/v1/sessions/:sessionId/rounds/:roundId/reveal
POST /api/v1/sessions/:sessionId/complete
GET  /api/v1/assets/:key
PUT  /api/v1/admin/assets/:key
```

---

# Source of Truth

```text
GitHub main
│
├─ Frontend → Vercel
│
└─ cloudflare/
   ├─ src/index.js      → Worker API
   ├─ migrations/       → D1 schema
   └─ wrangler.jsonc    → Cloudflare config
```

อย่าแก้ Worker code สดใน Dashboard แล้วปล่อยค้างไว้ เพราะ GitHub `main` ต้องเป็น Source of Truth
