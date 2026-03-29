const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
    path: '/socket.io',
    cors: { origin: "*" }
});
const yts = require('yt-search');

app.use(express.static('public'));
app.use(express.json());

const MAX_ROOMS = 100;
let roomQueues = {};
for (let i = 1; i <= MAX_ROOMS; i++) { roomQueues[`Room${i}`] = []; }
let activeTVs = {}; 
let cleanupTimers = {}; // สำหรับเก็บเวลานับถอยหลังลบคิว

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        // ✨ คงคำค้นหาเดิมของคุณไว้เพื่อให้เจอ "ต้นฉบับ/Original" ก่อนแม่นๆ
        const r = await yts(`${query} คาราโอเกะ karaoke th`);
        const videos = r.videos.slice(0, 20); 
        res.json(videos.map(v => ({ title: v.title, videoId: v.videoId, thumbnails: v.thumbnail })));
    } catch (err) { res.status(500).json({ error: "Search failed" }); }
});

io.on('connection', (socket) => {
    socket.on('tv_init', (data) => {
        let assignedRoom = data ? data.savedRoom : null;
        const isRoomBusy = Object.values(activeTVs).some(t => t.room === assignedRoom && t.id !== socket.id);
        
        if (!assignedRoom || isRoomBusy) {
            assignedRoom = null;
            for (let i = 1; i <= MAX_ROOMS; i++) {
                const rName = `Room${i}`;
                if (!Object.values(activeTVs).some(t => t.room === rName)) {
                    assignedRoom = rName;
                    break;
                }
            }
        }

        if (assignedRoom) {
            const pass = Math.floor(1000 + Math.random() * 9000).toString();
            activeTVs[socket.id] = { id: socket.id, room: assignedRoom, pass: pass };
            socket.join(assignedRoom);
            socket.isTV = true; // มาร์คไว้ว่าเป็นเครื่อง TV
            socket.roomId = assignedRoom;
            socket.emit('tv_assigned', { roomId: assignedRoom, pass: pass });
            console.log(`📺 TV Assigned: ${assignedRoom}`);
        }
    });

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.isTV = false; // มาร์คไว้ว่าเป็น Controller (มือถือ)
        console.log(`📱 Controller joined: ${roomId}`);
        
        // ✨ ถ้ามีคนกลับเข้าห้อง ให้ยกเลิกการลบคิวทันที
        if (cleanupTimers[roomId]) {
            clearTimeout(cleanupTimers[roomId]);
            delete cleanupTimers[roomId];
            console.log(`♻️ Cleanup cancelled for ${roomId}`);
        }
        
        if (roomQueues[roomId]) socket.emit('queue_update', roomQueues[roomId]);
    });

    socket.on('add_to_queue', (data) => {
        const { roomId, song } = data;
        if(roomQueues[roomId]) {
            roomQueues[roomId].push(song);
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
            if (roomQueues[roomId].length === 1) {
                io.to(roomId).emit('play', song);
            }
        }
    });

    socket.on('control_video', (data) => {
        const { roomId, action } = data;
        io.to(roomId).emit('video_action', action);
    });

    socket.on('force_retry_play', (roomId) => {
        if (roomQueues[roomId] && roomQueues[roomId].length > 0) {
            io.to(roomId).emit('play', roomQueues[roomId][0]);
        }
    });

    socket.on('move_song', (data) => {
        const { roomId, index, direction } = data;
        const queue = roomQueues[roomId];
        if (!queue || index <= 0) return;
        const newIndex = (direction === 'up') ? index - 1 : index + 1;
        if (newIndex > 0 && newIndex < queue.length) {
            const song = queue.splice(index, 1)[0];
            queue.splice(newIndex, 0, song);
            io.to(roomId).emit('queue_update', queue);
        }
    });

    socket.on('delete_song', (data) => {
        const { roomId, index } = data;
        if (roomQueues[roomId] && index > 0) {
            roomQueues[roomId].splice(index, 1);
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
        }
    });

    socket.on('song_ended', (roomId) => {
        if (roomQueues[roomId] && roomQueues[roomId].length > 0) {
            roomQueues[roomId].shift();
            const nextSong = roomQueues[roomId][0] || null;
            io.to(roomId).emit('play', nextSong);
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
        }
    });

    socket.on('skip_song', (roomId) => {
        if (roomQueues[roomId] && roomQueues[roomId].length > 0) {
            roomQueues[roomId].shift();
            io.to(roomId).emit('play', roomQueues[roomId][0] || null);
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
        }
    });

    socket.on('disconnect', () => { 
        if (socket.isTV) {
            console.log(`❌ TV Disconnected: ${socket.roomId}`);
            delete activeTVs[socket.id]; 
        } else if (socket.roomId) {
            // ✨ ระบบ Auto-Cleanup: เมื่อ Controller (มือถือ) ออกจากห้อง
            const roomId = socket.roomId;
            const room = io.sockets.adapter.rooms.get(roomId);
            
            // เช็คว่าในห้องเหลือแค่ TV เครื่องเดียวหรือไม่ (ถ้าเหลือ <= 1 คือไม่มีมือถือแล้ว)
            if (!room || room.size <= 1) {
                console.log(`⏳ Room ${roomId} is empty. Cleaning up in 60s...`);
                cleanupTimers[roomId] = setTimeout(() => {
                    roomQueues[roomId] = []; // ล้างคิวเพลง
                    io.to(roomId).emit('queue_update', []);
                    io.to(roomId).emit('play', null); // หยุดเล่นเพลงบน TV
                    console.log(`🧹 Queue cleared for ${roomId}`);
                    delete cleanupTimers[roomId];
                }, 60000); // ✨ ตั้งเวลาไว้ 1 นาที (เผื่อเน็ตมือถือหลุดแล้วกลับมาใหม่)
            }
        }
    });
});

http.listen(3030, () => console.log('🚀 Karaoke Server: Running on Port 3030'));
