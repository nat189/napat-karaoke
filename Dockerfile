FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# ไม่ต้องรัน npm install ในนี้ก็ได้ถ้าคุณ Map Volume ที่มี node_modules มาแล้ว
# แต่ถ้าอยากให้มันช่วยลงให้ ก็รันไว้เป็นพื้นฐานครับ
RUN npm install --production
COPY . .
EXPOSE 3030
# แนะนำให้ใช้เครื่องมืออย่าง nodemon (ถ้าอยากให้มันรีสตาร์ทโค้ดเองเวลาเซฟไฟล์)
# แต่ถ้าไม่ซีเรียส ใช้ node server.js ตามเดิมได้ครับ
CMD ["node", "server.js"]