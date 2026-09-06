# แก้รูปและเฉลย — Reveal Game v20.5

## วิธีที่แนะนำ

ไม่ต้องแก้ JSON หรือ HTML แล้ว ให้ใช้หน้า Setup:

`https://reveal-game.vercel.app/setup.html`

Flow:

1. ตั้งชื่อเกม
2. อัปโหลดรูป
3. ใส่คำเฉลย
4. แก้คำถามได้ถ้าอยาก
5. เพิ่มได้สูงสุด 10 ข้อ
6. กด **เก็บไว้ก่อน**
7. กด **ลุยเลย** เพื่อเข้าเกม

## การเก็บข้อมูล

v20.5 เก็บเกมใน IndexedDB ของ browser เครื่องนั้น

- เปลี่ยนเครื่อง = ข้อมูลไม่ตามไป
- ล้าง browser storage = เกมที่สร้างอาจหาย
- ยังไม่มี cloud sync

## รูปภาพ

รองรับไฟล์ภาพทั่วไป เช่น JPG / PNG / WebP

ระบบจะจัดรูปอัตโนมัติ:

- Source file สูงสุด 15MB
- Resize ด้านยาวไม่เกิน 1600px
- Re-encode ทุกครั้งก่อนบันทึก
- เป้าหมายไฟล์หลังบีบอัดประมาณ ≤2.5MB

แนะนำภาพสัดส่วน 1:1 เพื่อให้เข้ากับกระดาน 3×3 ได้ดีที่สุด

## ถ้ายังไม่ได้ Save

หน้า Setup จะเตือนก่อนออกจากหน้า เพื่อกันข้อมูลที่เพิ่งแก้หาย

## Demo fallback

ถ้า browser ยังไม่มีเกมที่สร้างเอง หน้า Player จะใช้ `data/questions.json` เป็น Demo fallback

แก้ `data/questions.json` เฉพาะเมื่ออยากเปลี่ยน **ชุด Demo ที่มากับระบบ** เท่านั้น

## ไฟล์สำหรับ Developer

- UI shared: `css/game.css`
- Setup UI: `css/setup.css`
- Player logic: `js/game.js`
- Builder logic: `js/setup.js`
- IndexedDB: `js/storage.js`
- Demo data: `data/questions.json`

## QA ก่อน merge

```bash
npm install
npm run check
npm test
```
