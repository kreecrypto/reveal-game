# แก้รูปและเฉลย — Reveal Game v19

## แก้เฉลย / คำถาม / ลำดับ
แก้เฉพาะ `data/questions.json`

## เปลี่ยนรูป
ในแต่ละรายการ เปลี่ยนค่า `image` เป็น URL หรือ path ของรูปใหม่ได้เลย เช่น:

```json
{
  "id": 1,
  "question": "ภาพนี้คืออะไร?",
  "answer": "แมว",
  "image": "/assets/images/01.webp",
  "alt": "ภาพแมว"
}
```

แนะนำรูป 1:1 ขนาด 1200×1200 และ WebP/JPG/PNG

ตอนนี้ demo ใช้ data-URI ใน `questions.json` เพื่อให้ v19 deploy ได้โดยไม่ต้องฝังรูปใน `index.html`

## UI
Design token ทั้งหมดอยู่ใน `css/game.css` ที่ `:root`

## Logic
อยู่ใน `js/game.js` ไม่ต้องแก้เมื่อเปลี่ยนรูปหรือเฉลย
