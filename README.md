# Reveal Game

เกมเปิดป้ายภาพแนว Cute Arcade

## ตอนนี้ใช้ระบบอะไรบ้าง

- **GitHub** = ที่เก็บโค้ดหลัก (Source of Truth)
- **Vercel** = เว็บ Production
- **Cloudflare Worker** = API
- **Cloudflare D1** = เก็บข้อมูลเกม/Session
- **Cloudflare R2** = เก็บรูปที่อัปโหลด

## วิธีทำงานที่ต้องการ

หลังเชื่อม GitHub กับ Vercel แล้ว การทำงานจะง่ายแบบนี้:

1. แก้โค้ดใน GitHub
2. Push เข้า branch `main`
3. Vercel จะสร้าง Production deployment ให้อัตโนมัติ
4. เปิด `reveal-game.vercel.app` เพื่อตรวจของจริง

ไม่ต้องส่งไฟล์ HTML เข้า Vercel แบบ manual อีก

## เชื่อม GitHub กับ Vercel (ทำครั้งเดียว)

Repo ที่ต้องเชื่อม:

`kreecrypto/reveal-game`

Vercel project ที่ต้องใช้:

`reveal-game`

ทำตามนี้ใน Vercel:

1. เปิด project `reveal-game`
2. เข้า **Settings**
3. เข้าเมนู **Git**
4. กด **Connect Git Repository**
5. เลือก **GitHub**
6. เลือก repo `kreecrypto/reveal-game`
7. ตั้ง **Production Branch** เป็น `main`
8. ตรวจว่า **Root Directory** เป็น `./` หรือเว้นว่าง
9. Save

หลังจากนี้ทุกครั้งที่ `main` มี commit ใหม่ Vercel จะ deploy ให้อัตโนมัติ

## ไฟล์สำคัญ

- `index.html` = หน้าเกมหลัก
- `vercel.json` = การตั้งค่า Vercel
- `cloudflare/wrangler.jsonc` = การตั้งค่า Cloudflare Worker / D1 / R2
- `cloudflare/src/index.js` = API Worker
- `cloudflare/migrations/0001_init.sql` = โครงสร้างฐานข้อมูลเริ่มต้น

## กฎของโปรเจกต์

- ให้ GitHub `main` เป็น Source of Truth
- ห้ามแก้ Production โดยอัป HTML ตรง ถ้าไม่ใช่กรณี Recovery
- ก่อนปล่อย Production ต้องตรวจหน้าเว็บจริงบนมือถือ
- ถ้า Production พัง ให้ rollback ไป commit ก่อนหน้า แทนการแก้สดบน Production

## Cloudflare

ดูรายละเอียดใน `cloudflare/README.md`
