# 🎤 Napat Karaoke System
ระบบคาราโอเกะอัจฉริยะ รองรับการสั่งงานผ่านมือถือ (Remote) และหน้าจอทีวี (Smart TV) 
รันบน Node.js (เหมาะสำหรับ Unraid, Docker หรือ PC ทั่วไป)

## ✨ ฟีเจอร์หลัก
- 📺 **Google TV Style:** หน้าจอพักจอสุ่มรูปภาพสวยๆ อัตโนมัติ
- 📱 **Professional Remote:** ดีไซน์ Dark Mode ค้นหาเพลงแม่นยำ และจัดคิวเพลงได้
- 🔇 **No-Click Autoplay:** เพลงเล่นเองทันทีที่จอง ไม่ต้องเดินไปกดหน้าจอทีวี
- 🧹 **Auto-Cleanup:** ลบคิวเพลงอัตโนมัติเมื่อไม่มีคนอยู่ในห้องเกิน 1 นาที
- ☁️ **Cloudflare Support:** รองรับการใช้งานผ่าน Cloudflare Tunnel / Proxy

## 🛠 การติดตั้ง (Installation)

### 1. ติดตั้ง Node.js
ตรวจสอบว่าเครื่องของคุณติดตั้ง Node.js แล้ว (แนะนำเวอร์ชัน 16 ขึ้นไป)

### 2. ดาวน์โหลดโค้ด
```bash
git clone [https://github.com/ช](https://github.com/ช)ื่อของคุณ/napat-karaoke.git
cd napat-karaoke

3. ติดตั้ง Library ที่จำเป็น
Bash
npm install express socket.io yt-search
4. เริ่มใช้งาน
Bash
# รันปกติ
node server.js
# หรือรันผ่าน PM2 (แนะนำสำหรับ Unraid)
pm2 start server.js --name "karaoke"

ตืดตั้งผ่าน docker
cd /mnt/cache/appdata/
git clone https://github.com/nat189/napat-karaoke.git napat-karaoke
สั่ง Build ใหม่
Bash
docker build -t nat189/napat-karaoke .



🌐 การเข้าใช้งาน
หน้าจอทีวี: http://your-ip:3000/display.html

รีโมทมือถือ: http://your-ip:3000/controller.html (หรือสแกน QR Code จากหน้าจอทีวี)

พัฒนาโดย: Natthapat Panchon


---
