const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const ROOMS = {}; // roomId -> room object

function makeRoomId() { return nanoid(6).toLowerCase(); }
function makeToken() { return nanoid(28); }

app.post('/api/create-room', (req, res) => {
  const { mainWord, specialWord, players = 21, specialCount = 2, revealAt = null } = req.body;
  if (!mainWord || !specialWord) return res.status(400).json({ error: 'Missing words' });

  const roomId = makeRoomId();
  const hostToken = makeToken();

  const arr = [];
  for (let i=0; i < players - specialCount; i++) arr.push(mainWord);
  for (let i=0; i < specialCount; i++) arr.push(specialWord);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  ROOMS[roomId] = {
    createdAt: Date.now(),
    hostToken,
    players: [],
    assignments: arr,
    assignedMap: {},
    usedSlots: new Set(),
    reveal: false,
    revealAt: revealAt ? new Date(revealAt).getTime() : null,
    maxPlayers: players
  };

  res.json({ roomId, hostToken, joinUrl: `/room/${roomId}` });
});

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
