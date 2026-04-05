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
let roomStatus = {}; 
for (let i = 1; i <= MAX_ROOMS; i++) { 
    roomQueues[`Room${i}`] = []; 
    roomStatus[`Room${i}`] = { isPlaying: false };
}
let activeTVs = {};
let tvCleanupTimers = {}; // ตัวนับเวลาล้างคิวเมื่อ TV หลุด

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        const r = await yts(`${query} คาราโอเกะ karaoke th`);
        res.json(r.videos.slice(0, 20).map(v => ({ title: v.title, videoId: v.videoId, thumbnails: v.thumbnail })));
    } catch (err) { res.status(500).json({ error: "Search failed" }); }
});

io.on('connection', (socket) => {
    socket.on('tv_init', (data) => {
        let assignedRoom = data ? data.savedRoom : null;
        if (!assignedRoom || Object.values(activeTVs).some(t => t.room === assignedRoom && t.id !== socket.id)) {
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
            activeTVs[socket.id] = { id: socket.id, room: assignedRoom };
            socket.join(assignedRoom);
            socket.isTV = true;
            socket.roomId = assignedRoom;

            // ✨ ถ้า TV เครื่องเดิมกลับมาเชื่อมต่อ ให้ยกเลิกการล้างคิว
            if (tvCleanupTimers[assignedRoom]) {
                clearTimeout(tvCleanupTimers[assignedRoom]);
                delete tvCleanupTimers[assignedRoom];
                console.log(`♻️ TV Reconnected: ${assignedRoom} - Queue Restored`);
            }

            socket.emit('tv_assigned', { roomId: assignedRoom });
            console.log(`📺 TV Connected: ${assignedRoom}`);
        }
    });

    socket.on('join_room', (roomId) => {
        if (!roomId) return;
        socket.join(roomId);
        socket.roomId = roomId;
        socket.isTV = false;
        if (roomQueues[roomId]) socket.emit('queue_update', roomQueues[roomId]);
    });

    socket.on('add_to_queue', (data) => {
        const { roomId, song } = data;
        if(roomQueues[roomId]) {
            const isDuplicate = roomQueues[roomId].some(s => s.videoId === song.videoId);
            if (isDuplicate) return;
            roomQueues[roomId].push(song);
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
            if (roomQueues[roomId].length === 1 && !roomStatus[roomId].isPlaying) {
                roomStatus[roomId].isPlaying = true;
                io.to(roomId).emit('play', song);
            }
        }
    });

    socket.on('move_song', (data) => {
        const { roomId, index, direction } = data;
        const queue = roomQueues[roomId];
        if (!queue || index < 0 || index >= queue.length) return;
        const newIndex = (direction === 'up') ? index - 1 : index + 1;
        if (newIndex >= 0 && newIndex < queue.length) {
            const song = queue.splice(index, 1)[0];
            queue.splice(newIndex, 0, song);
            io.to(roomId).emit('queue_update', queue);
        }
    });

    socket.on('control_video', (data) => {
        io.to(data.roomId).emit('control_video', { action: data.action });
    });

    socket.on('force_retry_play', (roomId) => {
        if (roomQueues[roomId] && roomQueues[roomId].length > 0) {
            roomStatus[roomId].isPlaying = true;
            io.to(roomId).emit('play', roomQueues[roomId][0]);
        }
    });

    socket.on('delete_song', (data) => {
        const { roomId, index } = data;
        if (roomQueues[roomId] && index >= 0) {
            roomQueues[roomId].splice(index, 1);
            if (index === 0) roomStatus[roomId].isPlaying = false;
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
        }
    });

    socket.on('song_ended', (roomId) => {
        if (roomQueues[roomId] && roomQueues[roomId].length > 0) {
            roomQueues[roomId].shift();
            const nextSong = roomQueues[roomId][0] || null;
            if (nextSong) {
                roomStatus[roomId].isPlaying = true;
                io.to(roomId).emit('play', nextSong);
            } else {
                roomStatus[roomId].isPlaying = false;
                io.to(roomId).emit('play', null);
            }
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
        }
    });

    socket.on('skip_song', (roomId) => {
        if (roomQueues[roomId] && roomQueues[roomId].length > 0) {
            roomQueues[roomId].shift();
            const nextSong = roomQueues[roomId][0] || null;
            roomStatus[roomId].isPlaying = !!nextSong;
            io.to(roomId).emit('play', nextSong);
            io.to(roomId).emit('queue_update', roomQueues[roomId]);
        }
    });

    socket.on('disconnect', () => {
        // ✨ ถ้าเป็นหน้าจอ TV ที่หลุด (ปิดห้อง)
        if (socket.isTV && socket.roomId) {
            const rId = socket.roomId;
            delete activeTVs[socket.id];
            
            // นับถอยหลัง 30 วินาที ถ้า TV ไม่กลับมา ให้ล้างคิว (ปิดห้องถาวร)
            console.log(`⚠️ TV Disconnected: ${rId}. Waiting 30s before clearing room...`);
            tvCleanupTimers[rId] = setTimeout(() => {
                roomQueues[rId] = [];
                roomStatus[rId].isPlaying = false;
                io.to(rId).emit('queue_update', []);
                io.to(rId).emit('play', null);
                delete tvCleanupTimers[rId];
                console.log(`🧹 Room Cleared (TV Closed): ${rId}`);
            }, 30000); 
        }
        // ถ้าเป็นมือถือหลุด ไม่ต้องทำอะไร (คิวไม่หาย)
    });
});

http.listen(3030, () => console.log('🚀 Karaoke Server Ready: TV-Link Mode Enabled'));
