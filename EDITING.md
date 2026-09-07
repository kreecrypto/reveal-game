# แก้รูปและเฉลย — Reveal Game v20.6

## วิธีที่แนะนำ

ไม่ต้องแก้ JSON หรือ HTML แล้ว ให้ใช้หน้า Setup:

`https://reveal-game.vercel.app/setup.html`

Flow:

1. ตั้งชื่อเกม
2. อัปโหลดรูป
3. จัดรูปใน Image Editor
4. ลากเพื่อเลือกส่วนที่จะเห็น
5. ย่อ / ขยายให้พอดี
6. กด **ใช้รูปนี้**
7. ใส่คำเฉลย
8. แก้คำถามได้ถ้าอยาก
9. เพิ่มได้สูงสุด 10 ข้อ
10. กด **เก็บไว้ก่อน**
11. กด **ลุยเลย** เพื่อเข้าเกม

## Image Editor

เมื่อเลือกรูป ระบบจะเปิดตัวแก้ภาพอัตโนมัติ

ทำได้:

- **ลากรูป** เพื่อจัดตำแหน่ง
- **Slider** เพื่อย่อ / ขยาย
- ปุ่ม **− / +** เพื่อปรับ Zoom ทีละนิด
- **Pinch 2 นิ้ว** บนมือถือเพื่อ Zoom
- Mouse wheel บน Desktop เพื่อ Zoom
- **จัดกลางใหม่** เพื่อ Reset
- Crop เป็น **1:1** ให้ตรงกับบอร์ด 3×3

กด **ไม่เอาละ** หรือ Escape = ปิด Editor โดยไม่เปลี่ยนรูป

กด **ใช้รูปนี้** = Apply Crop และถือว่าเป็น Unsaved Change จนกว่าจะกด **เก็บไว้ก่อน**

ถ้ามีรูปอยู่แล้ว:

- แตะรูป หรือกด **แก้ภาพ** = กลับเข้า Editor พร้อมตำแหน่ง/Zoom เดิม
- กด **เปลี่ยนรูป** = เลือกรูปต้นฉบับใหม่

## การเก็บข้อมูล

v20.6 เก็บเกมใน IndexedDB ของ browser เครื่องนั้น

- เปลี่ยนเครื่อง = ข้อมูลไม่ตามไป
- ล้าง browser storage = เกมที่สร้างอาจหาย
- ยังไม่มี cloud sync

สำหรับรูปใหม่ ระบบเก็บทั้ง:

- `sourceImageBlob` รูปต้นทางที่บีบอัดแล้ว
- `imageBlob` รูป 1:1 หลัง Crop
- `imageCrop` ค่า Zoom และตำแหน่ง

เพื่อให้กลับมาแก้ Crop ภายหลังได้โดยไม่เสียพื้นที่ภาพต้นทาง

## รูปภาพ

รองรับไฟล์ภาพทั่วไป เช่น JPG / PNG / WebP

Pipeline:

```text
Upload
→ Validate
→ Resize / Compress Source
→ Edit / Pan / Zoom
→ Crop 1:1 (1024×1024)
→ WebP
→ IndexedDB
```

Limits:

- Source file สูงสุด 15MB
- Source compressed hard limit 3MB
- Cropped output hard limit 2.5MB

ไม่จำเป็นต้องเตรียมภาพ 1:1 ล่วงหน้าแล้ว เพราะ Crop ใน Setup ได้เลย

## ถ้ายังไม่ได้ Save

หน้า Setup จะเตือนก่อนออกจากหน้า เพื่อกันข้อมูลที่เพิ่งแก้หาย

การเปิด Image Editor เฉย ๆ ยังไม่ทำให้ข้อมูลเปลี่ยน จนกว่าจะกด **ใช้รูปนี้**

## Demo fallback

ถ้า browser ยังไม่มีเกมที่สร้างเอง หน้า Player จะใช้ `data/questions.json` เป็น Demo fallback

แก้ `data/questions.json` เฉพาะเมื่ออยากเปลี่ยน **ชุด Demo ที่มากับระบบ** เท่านั้น

## ไฟล์สำหรับ Developer

- UI shared: `css/game.css`
- Setup + Editor UI: `css/setup.css`
- Player logic: `js/game.js`
- Builder + Image Editor logic: `js/setup.js`
- IndexedDB: `js/storage.js`
- Demo data: `data/questions.json`

## QA ก่อน merge

```bash
npm install
npm run check
npm test
```

Critical flow ที่ต้องผ่าน:

```text
Upload → Editor → Zoom/Pan → Apply → Save → Reload → Edit again → Play
```
