# AI Creator Studio V2.1

## รันระบบ
```bash
node backend/server-lite.js
# เปิด http://localhost:3847
```

มือถือ: `start-mobile.html` หรือดู `MOBILE-SETUP.md`

## บัญชีเริ่มต้น
| User | Pass | Plan |
|------|------|------|
| owner | owner123 | pro |
| admin | admin123 | vip |
| member | member123 | free |

สมาชิกสมัครใหม่ = **FREE** ทันที **ไม่ต้องใส่ API Key**

## VIP Code (ใหม่)
- สมาชิก: ตั้งค่า → ใส่ VIP Code → เปิดใช้งาน
- Owner: ผู้ดูแลระบบ → สร้างโค้ดสมาชิก
- API: `POST /api/membership/redeem`

VIP Code **ไม่ใช่** API Key ของ AI

## Provider (เฉพาะ Owner/Server)
ใส่ใน `.env` เท่านั้น:
```
GEMINI_API_KEY=
OPENAI_API_KEY=
IMAGE_API_KEY=
VIDEO_API_KEY=
```
สมาชิกไม่เห็นและไม่กรอก key

## สิ่งที่ทำแล้วในรอบนี้
- FREE default + VIP Code redeem
- Owner สร้าง/ปิดรหัสสมาชิก
- Access resolution (plan / individual / global)
- Backend enforce feature บน AI / import
- Membership dashboard ในหน้าตั้งค่า

## ยังไม่ครบทั้ง Master Prompt
Avatar/Voice/Lip Sync, PostgreSQL, Docker Worker, SSE Chat ฯลฯ ยังเป็นเฟสถัดไปเมื่อมี Provider จริง
