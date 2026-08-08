# AI Creator Studio — คู่มือมือถือ Android

## ความจริงที่ต้องรู้

- ไฟล์ ZIP **ไม่สามารถ** รัน AI / วิดีโอ / Database ทั้งหมดในเบราว์เซอร์มือถือเพียงอย่างเดียว
- ต้องมี **Backend รันอยู่** (บนมือถือผ่าน Termux หรือบนเซิร์ฟเวอร์ออนไลน์)
- ถ้าไม่มี API Key ของ Provider → ระบบจะแสดง **NOT_CONFIGURED** ไม่ปลอมผลลัพธ์

---

## วิธี A: รันบน Android ด้วย Termux (ไม่มีคอม)

1. ติดตั้ง **Termux** จาก F-Droid  
   https://f-droid.org/packages/com.termux/

2. ใน Termux:
```bash
pkg update -y
pkg install -y nodejs-lts unzip
termux-setup-storage
```

3. คัดลอกโฟลเดอร์โปรเจกต์ไปที่ `Download` แล้ว:
```bash
cd ~/storage/downloads/acs-v2
# หรือชื่อโฟลเดอร์ที่คุณแตก zip
node backend/server-lite.js
```

4. เปิด Chrome → `http://localhost:3847`  
   หรือเปิด `start-mobile.html` ผ่านเซิร์ฟเวอร์เดียวกัน

5. ติดตั้งแอป: Chrome ⋮ → **ติดตั้งแอป** / Add to Home screen

**อย่าปิด Termux** ขณะใช้งาน

---

## วิธี B: มีคอมในบ้าน

1. รันเซิร์ฟเวอร์บนคอม (`START-WINDOWS.bat` / `start-linux.sh`)
2. มือถือกับคอมอยู่ Wi-Fi เดียวกัน
3. Chrome บนมือถือเปิด `http://<IP-คอม>:3847`

---

## วิธี C: Host ออนไลน์ (แนะนำระยะยาว)

อัปโหลดโปรเจกต์ไปยัง VPS / Cloud แล้วชี้โดเมน  
ผู้ใช้เปิดจากมือถือได้เลยโดยไม่ต้องรัน Termux

---

## บัญชีเริ่มต้น

| User | Password |
|------|----------|
| owner | owner123 |
| admin | admin123 |
| member | member123 |

ประตู Admin: `secure2024`

---

## ตั้งค่า AI

แก้ไขไฟล์ `.env`:
```
GEMINI_API_KEY=
OPENAI_API_KEY=
IMAGE_API_KEY=
VIDEO_API_KEY=
```
แล้วรีสตาร์ทเซิร์ฟเวอร์
