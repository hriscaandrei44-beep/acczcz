import express from 'express';


app.post('/api/room/:roomId/join', (req, res) => {
const room = ROOMS[req.params.roomId];
if (!room) return res.status(404).json({ error: 'Room not found' });
if (room.players.length >= room.maxPlayers)
return res.status(400).json({ error: 'Room full' });


let idx = null;
for (let i = 0; i < room.assignments.length; i++) {
if (!room.usedSlots.has(i)) { idx = i; break; }
}
if (idx === null) return res.status(400).json({ error: 'No slots left' });


const token = makeToken();
room.players.push({ token, joinedAt: Date.now(), slot: idx + 1 });
room.assignedMap[token] = idx;
room.usedSlots.add(idx);


const now = Date.now();
const revealed = room.reveal || (room.revealAt && now >= room.revealAt);


res.json({
token,
slot: idx + 1,
revealed,
word: revealed ? room.assignments[idx] : null,
revealAt: room.revealAt
});
});


app.get('/api/player/:token/status', (req, res) => {
const token = req.params.token;
let found = null;
for (const roomId in ROOMS) {
const r = ROOMS[roomId];
if (r.assignedMap[token] !== undefined) {
found = { roomId, room: r };
break;
}
}
if (!found) return res.status(404).json({ error: 'Invalid token' });


const { room } = found;
const idx = room.assignedMap[token];
const now = Date.now();
const revealed = room.reveal || (room.revealAt && now >= room.revealAt);


res.json({
slot: idx + 1,
revealed,
word: revealed ? room.assignments[idx] : null,
revealAt: room.revealAt
});
});


app.post('/api/room/:roomId/reveal', (req, res) => {
const room = ROOMS[req.params.roomId];
if (!room) return res.status(404).json({ error: 'Room not found' });


const { hostToken } = req.body;
if (hostToken !== room.hostToken)
return res.status(403).json({ error: 'Invalid host token' });


room.reveal = true;
room.revealAt = null;


res.json({ ok: true });
});


app.get('/room/:roomId', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on', PORT));
