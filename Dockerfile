# เปลี่ยนจาก node:18-slim เป็น node:20-slim ✨
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
