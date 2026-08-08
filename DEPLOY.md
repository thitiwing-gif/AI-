# แก้ Login ไม่ได้บน Netlify

## สาเหตุ
Netlify โฮสต์ **แค่ไฟล์ Frontend**  
Backend (`server-lite.js`) **รันบน Netlify ไม่ได้**

เมื่อกด Login เบราว์เซอร์ยิง `/api/auth/login` ไปที่ Netlify  
ได้หน้า HTML กลับมา → ขึ้น **Invalid response**

## วิธีแก้ (เลือกอย่างใดอย่างหนึ่ง)

### 1) รัน Backend เอง + ตั้ง URL ในหน้า Login
1. รันบนคอมหรือ VPS / Railway / Render:
   ```bash
   node backend/server-lite.js
   ```
2. เปิด Frontend บน Netlify
3. ในช่อง **URL Backend** ใส่ เช่น:
   - `http://IP-เครื่อง:3847` (มือถือกับคอม Wi‑Fi เดียวกัน)
   - `https://your-app.railway.app` (ถ้า deploy backend)
4. กด **บันทึก** → **ลองใหม่** จนจุดเป็นสีเขียว
5. Login ใหม่

### 2) Deploy Backend ฟรี (แนะนำ)

| บริการ | หมายเหตุ |
|--------|----------|
| [Railway](https://railway.app) | Deploy โฟลเดอร์ backend, start: `node server-lite.js` |
| [Render](https://render.com) | Web Service, same |
| [Fly.io](https://fly.io) | ต้องมีบัญชี |

หลังได้ URL เช่น `https://acs-api.up.railway.app`  
ใส่ในช่อง URL Backend บนหน้า Login แล้วบันทึก

### 3) ใช้ localhost (Termux บนมือถือ)
ดู `MOBILE-SETUP.md` — ไม่ผ่าน Netlify

## CORS
`server-lite.js` อนุญาตทุก origin อยู่แล้วสำหรับ local/dev  
Production ควรจำกัด origin เป็นโดเมน Netlify ของคุณ

## ตรวจว่า Backend ใช้ได้
เปิดในเบราว์เซอร์:
```
https://YOUR-BACKEND/api/health
```
ต้องได้ JSON ประมาณ:
```json
{"success":true,"status":"ok","version":"1.0.0"}
```
