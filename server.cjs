require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { pool, defaultPermissions, initDb } = require('./database/db.cjs');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'fleet-management-secret-key-2026';

// ── Socket.io ────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Neautorizat'));
  try {
    socket.user = jwt.verify(token, SECRET);
    next();
  } catch {
    next(new Error('Token invalid'));
  }
});

// Online users per org: orgId → Map<socketId, username>
const onlineUsers = new Map();

function getOnlineList(orgId) {
  const orgMap = onlineUsers.get(orgId);
  if (!orgMap) return [];
  return [...new Set(orgMap.values())];
}

io.on('connection', async (socket) => {
  const orgId = socket.user.organization_id;
  const username = socket.user.username;

  socket.join(`org_${orgId}`);
  socket.join(`user_${username}_org_${orgId}`); // cameră privată pentru DM-uri
  console.log(`⚡ Socket: ${username} conectat (org ${orgId})`);

  // Join în camerele grupurilor din care face parte userul
  try {
    const groupsRes = await pool.query(
      'SELECT group_id FROM chat_group_members WHERE username=$1 AND organization_id=$2',
      [username, orgId]
    );
    groupsRes.rows.forEach(({ group_id }) => {
      socket.join(`group_${group_id}_org_${orgId}`);
    });
  } catch (e) {
    console.warn('⚡ Eroare join group rooms:', e.message);
  }

  if (!onlineUsers.has(orgId)) onlineUsers.set(orgId, new Map());
  onlineUsers.get(orgId).set(socket.id, username);
  io.to(`org_${orgId}`).emit('users_online', getOnlineList(orgId));

  // Logout explicit — actualizează imediat lista online, înainte ca socket-ul să se închidă
  socket.on('user_logout', () => {
    const orgMap = onlineUsers.get(orgId);
    if (orgMap) {
      orgMap.delete(socket.id);
      if (orgMap.size === 0) onlineUsers.delete(orgId);
    }
    io.to(`org_${orgId}`).emit('users_online', getOnlineList(orgId));
  });

  // Client cere lista curentă de useri online (după ce și-a înregistrat listener-ul)
  socket.on('get_online_users', () => {
    socket.emit('users_online', getOnlineList(orgId));
  });

  // Grup events — clientul cere să intre/iasă dintr-o cameră de grup
  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}_org_${orgId}`);
  });
  socket.on('leave_group', (groupId) => {
    socket.leave(`group_${groupId}_org_${orgId}`);
  });

  socket.on('typing', ({ to, groupId }) => {
    const uname = socket.user?.username;
    if (!uname) return;
    if (groupId) {
      socket.to(`group_${groupId}_org_${orgId}`).emit('user_typing', { username: uname, groupId });
    } else if (to) {
      io.to(`user_${to}_org_${orgId}`).emit('user_typing', { username: uname, to });
    }
  });

  socket.on('stop_typing', ({ to, groupId }) => {
    const uname = socket.user?.username;
    if (!uname) return;
    if (groupId) {
      socket.to(`group_${groupId}_org_${orgId}`).emit('user_stop_typing', { username: uname, groupId });
    } else if (to) {
      io.to(`user_${to}_org_${orgId}`).emit('user_stop_typing', { username: uname });
    }
  });

  socket.on('disconnect', () => {
    console.log(`⚡ Socket: ${username} deconectat`);
    const orgMap = onlineUsers.get(orgId);
    if (orgMap) {
      orgMap.delete(socket.id);
      if (orgMap.size === 0) onlineUsers.delete(orgId);
    }
    io.to(`org_${orgId}`).emit('users_online', getOnlineList(orgId));
  });
});

// Helper: trimite eveniment la toți clienții din aceeași organizație
function emitToOrg(organizationId, event, payload = {}) {
  io.to(`org_${organizationId}`).emit(event, payload);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// ── Middleware auth ─────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Neautorizat' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid' });
  }
}

// ── Middleware permisiuni ───────────────────────────────────
function requirePermission(perm) {
  return (req, res, next) => {
    const perms = req.user.permissions || {};
    if (perms[perm]) return next();
    res.status(403).json({ error: 'Acces interzis', permission: perm });
  };
}

// ── CHAT ────────────────────────────────────────────────────

// Toți userii din organizație (pentru lista de contacte)
app.get('/api/chat/users', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `SELECT u.username, u.role, u.first_name, u.last_name,
         lm.message    AS last_message,
         lm.created_at AS last_message_at
       FROM users u
       LEFT JOIN LATERAL (
         SELECT message, created_at
         FROM chat_messages
         WHERE ((username = $1 AND receiver_username = u.username)
             OR (username = u.username AND receiver_username = $1))
           AND is_deleted = FALSE
         ORDER BY created_at DESC
         LIMIT 1
       ) lm ON true
       WHERE u.organization_id = $2 AND u.username != $1
       ORDER BY COALESCE(lm.created_at, '1970-01-01') DESC, u.username`,
      [me, orgId]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Conversație privată cu un peer (ultimele 100 mesaje)
app.get('/api/chat/messages/:peer', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const { peer } = req.params;
    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE organization_id = $1
         AND ((username = $2 AND receiver_username = $3)
           OR (username = $3 AND receiver_username = $2))
       ORDER BY created_at DESC LIMIT 100`,
      [req.user.organization_id, me, peer]
    );
    res.json(result.rows.reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trimite mesaj privat
app.post('/api/chat/messages', authMiddleware, async (req, res) => {
  const { to, message, reply_to_id, reply_to_text, reply_to_username, image_data, image_type } = req.body;
  if (!to || (!message?.trim() && !image_data)) return res.status(400).json({ error: 'Date lipsă' });
  const msgType = image_data ? 'image' : 'text';
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (organization_id, username, receiver_username, message, reply_to_id, reply_to_text, reply_to_username, message_type, image_data, image_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.organization_id, req.user.username, to, message?.trim() || '', reply_to_id || null, reply_to_text || null, reply_to_username || null, msgType, image_data || null, image_type || null]
    );
    const msg = result.rows[0];
    const orgId = req.user.organization_id;
    io.to(`user_${to}_org_${orgId}`).emit('new_private_message', msg);
    io.to(`user_${req.user.username}_org_${orgId}`).emit('new_private_message', msg);
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marchează conversația cu peer-ul ca citită + notifică sender-ul
app.put('/api/chat/read/:peer', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    await pool.query(
      `INSERT INTO chat_conv_read (username, peer_username, organization_id, last_read_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username, peer_username, organization_id) DO UPDATE SET last_read_at = $4`,
      [req.user.username, req.params.peer, req.user.organization_id, now]
    );
    // Notifică sender-ul că mesajele lui au fost citite
    io.to(`user_${req.params.peer}_org_${req.user.organization_id}`)
      .emit('peer_read', { reader: req.user.username, last_read_at: now.toISOString() });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marchează TOATE mesajele (DM + grupuri) ca citite pentru userul curent
app.put('/api/chat/read-all', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const orgId = req.user.organization_id;
    const now = new Date();
    // DM — inserează/actualizează un read-record pentru fiecare peer care i-a trimis mesaje
    await pool.query(
      `INSERT INTO chat_conv_read (username, peer_username, organization_id, last_read_at)
       SELECT $1, cm.username, $2, $3
       FROM (SELECT DISTINCT username FROM chat_messages WHERE receiver_username = $1 AND organization_id = $2) cm
       ON CONFLICT (username, peer_username, organization_id) DO UPDATE SET last_read_at = $3`,
      [me, orgId, now]
    );
    // Grupuri — inserează/actualizează pentru fiecare grup din care face parte
    await pool.query(
      `INSERT INTO chat_group_read (username, group_id, organization_id, last_read_at)
       SELECT $1, gm.group_id, $2, $3
       FROM chat_group_members gm WHERE gm.username = $1 AND gm.organization_id = $2
       ON CONFLICT (username, group_id) DO UPDATE SET last_read_at = $3`,
      [me, orgId, now]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Când a citit peer-ul ultima oară conversația cu mine (pentru read receipts)
app.get('/api/chat/peer-read/:peer', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT last_read_at FROM chat_conv_read
       WHERE username = $1 AND peer_username = $2 AND organization_id = $3`,
      [req.params.peer, req.user.username, req.user.organization_id]
    );
    res.json(result.rows[0] || { last_read_at: null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Număr mesaje necitite per conversație
app.get('/api/chat/unread', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `SELECT cm.username AS peer, COUNT(*) AS unread
       FROM chat_messages cm
       LEFT JOIN chat_conv_read cr
         ON cr.username = $1 AND cr.peer_username = cm.username AND cr.organization_id = $2
       WHERE cm.receiver_username = $1
         AND cm.organization_id = $2
         AND (cr.last_read_at IS NULL OR cm.created_at > cr.last_read_at)
       GROUP BY cm.username`,
      [me, orgId]
    );
    const counts = {};
    result.rows.forEach(r => { counts[r.peer] = parseInt(r.unread); });
    res.json(counts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ultimul mesaj per conversație (pentru preview în contacts list)
app.get('/api/chat/last-messages', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `SELECT DISTINCT ON (peer)
         CASE WHEN username = $1 THEN receiver_username ELSE username END AS peer,
         username AS sender, message, created_at
       FROM chat_messages
       WHERE organization_id = $2
         AND receiver_username IS NOT NULL
         AND (username = $1 OR receiver_username = $1)
       ORDER BY peer, created_at DESC`,
      [me, orgId]
    );
    const lastMsgs = {};
    result.rows.forEach(r => { lastMsgs[r.peer] = r; });
    res.json(lastMsgs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Useri online curent (fallback REST)
app.get('/api/chat/online', authMiddleware, (req, res) => {
  res.json(getOnlineList(req.user.organization_id));
});

// ── CHAT GROUPS ──────────────────────────────────────────────

// Mesaje necitite per grup — ÎNAINTE de /:id pentru a evita conflict de rută
app.get('/api/chat/groups/unread', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `SELECT gm.group_id, COUNT(*) AS unread
       FROM chat_group_messages gm
       LEFT JOIN chat_group_read gr ON gr.group_id = gm.group_id AND gr.username = $1
       WHERE gm.organization_id = $2
         AND gm.username != $1
         AND (gr.last_read_at IS NULL OR gm.created_at > gr.last_read_at)
         AND (gm.message_type = 'text' OR gm.message_type IS NULL)
         AND gm.group_id IN (
           SELECT group_id FROM chat_group_members WHERE username = $1 AND organization_id = $2
         )
       GROUP BY gm.group_id`,
      [me, orgId]
    );
    const counts = {};
    result.rows.forEach(r => { counts[r.group_id] = parseInt(r.unread); });
    res.json(counts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Lista grupurilor din care face parte userul curent
app.get('/api/chat/groups', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `SELECT g.id, g.name, g.created_by, g.created_at,
         array_agg(gm2.username ORDER BY gm2.username) AS members,
         lm.username AS last_sender,
         lm.message   AS last_message,
         lm.message_type AS last_message_type,
         lm.created_at AS last_message_at
       FROM chat_groups g
       JOIN chat_group_members gm  ON gm.group_id  = g.id AND gm.username = $1
       JOIN chat_group_members gm2 ON gm2.group_id = g.id
       LEFT JOIN LATERAL (
         SELECT username, message, message_type, created_at
         FROM chat_group_messages
         WHERE group_id = g.id
         ORDER BY created_at DESC
         LIMIT 1
       ) lm ON true
       WHERE g.organization_id = $2
       GROUP BY g.id, lm.username, lm.message, lm.message_type, lm.created_at
       ORDER BY COALESCE(lm.created_at, g.created_at) DESC`,
      [me, orgId]
    );
    // Include member read times for seen indicators + last message
    for (const group of result.rows) {
      const readsRes = await pool.query(
        'SELECT username, last_read_at FROM chat_group_read WHERE group_id=$1 AND organization_id=$2',
        [group.id, orgId]
      );
      group.memberReads = readsRes.rows;
      if (group.last_sender) {
        group._lastMsg = {
          sender:     group.last_sender,
          message:    group.last_message,
          message_type: group.last_message_type,
          created_at: group.last_message_at,
        };
      }
    }
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Creare grup (admin only)
app.post('/api/chat/groups', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Doar adminii pot crea grupuri' });
  const { name, members } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Numele grupului este obligatoriu' });
  if (!Array.isArray(members) || members.length === 0) return res.status(400).json({ error: 'Selectează cel puțin un membru' });

  const orgId = req.user.organization_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const grpRes = await client.query(
      `INSERT INTO chat_groups (name, organization_id, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), orgId, req.user.username]
    );
    const group = grpRes.rows[0];

    // Adaugă membrii (inclusiv creatorul dacă nu e deja în listă)
    const allMembers = [...new Set([...members, req.user.username])];
    for (const m of allMembers) {
      await client.query(
        `INSERT INTO chat_group_members (group_id, username, organization_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [group.id, m, orgId]
      );
    }
    await client.query('COMMIT');

    const fullGroup = { ...group, members: allMembers };

    // Notifică fiecare membru în real-time
    allMembers.forEach(m => {
      io.to(`user_${m}_org_${orgId}`).emit('group_created', fullGroup);
    });

    res.json(fullGroup);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Ștergere grup (admin only)
app.delete('/api/chat/groups/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Doar adminii pot șterge grupuri' });
  const orgId = req.user.organization_id;
  const groupId = parseInt(req.params.id);
  try {
    // Obține membrii înainte de ștergere (pentru emit)
    const membersRes = await pool.query(
      `SELECT username FROM chat_group_members WHERE group_id = $1 AND organization_id = $2`,
      [groupId, orgId]
    );
    const members = membersRes.rows.map(r => r.username);

    await pool.query(
      `DELETE FROM chat_groups WHERE id = $1 AND organization_id = $2`,
      [groupId, orgId]
    );

    // Notifică membrii în real-time (CASCADE sterge automat membrii, mesajele, read receipts)
    io.to(`group_${groupId}_org_${orgId}`).emit('group_deleted', { id: groupId });
    members.forEach(m => {
      io.to(`user_${m}_org_${orgId}`).emit('group_deleted', { id: groupId });
    });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Actualizare membri grup (admin only) — body: { members: ['user1', ...] }
app.put('/api/chat/groups/:id/members', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Doar adminii pot modifica membrii' });
  const { members } = req.body;
  if (!Array.isArray(members)) return res.status(400).json({ error: 'Lista de membri este obligatorie' });

  const orgId = req.user.organization_id;
  const groupId = parseInt(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lista existentă de membri
    const existingRes = await client.query(
      `SELECT username FROM chat_group_members WHERE group_id = $1 AND organization_id = $2`,
      [groupId, orgId]
    );
    const existing = existingRes.rows.map(r => r.username);

    // Creatorul rămâne mereu în grup
    const creatorRes = await client.query(`SELECT created_by FROM chat_groups WHERE id=$1`, [groupId]);
    const creator = creatorRes.rows[0]?.created_by;
    const newMembers = [...new Set([...members, creator].filter(Boolean))];

    const toAdd = newMembers.filter(m => !existing.includes(m));
    const toRemove = existing.filter(m => !newMembers.includes(m));

    for (const m of toAdd) {
      await client.query(
        `INSERT INTO chat_group_members (group_id, username, organization_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [groupId, m, orgId]
      );
    }
    for (const m of toRemove) {
      await client.query(
        `DELETE FROM chat_group_members WHERE group_id=$1 AND username=$2`,
        [groupId, m]
      );
    }
    await client.query('COMMIT');

    // Notifică membrii adăugați să intre în camera de grup
    toAdd.forEach(m => {
      io.to(`user_${m}_org_${orgId}`).emit('group_member_added', { groupId });
    });
    // Notifică membrii scoși să iasă din camera de grup
    toRemove.forEach(m => {
      io.to(`user_${m}_org_${orgId}`).emit('group_member_removed', { groupId });
    });
    // Actualizează lista de membri pentru toți
    io.to(`group_${groupId}_org_${orgId}`).emit('group_updated', { id: groupId, members: newMembers });
    // Notifică și membrii adăugați (nu sunt încă în cameră)
    toAdd.forEach(m => {
      io.to(`user_${m}_org_${orgId}`).emit('group_updated', { id: groupId, members: newMembers });
    });

    // System messages for member changes
    for (const m of toAdd) {
      try {
        const msgRes = await pool.query(
          `INSERT INTO chat_group_messages (group_id, organization_id, username, message, message_type) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [groupId, orgId, 'SYSTEM', `${m} a fost adaugat in grup`, 'system']
        );
        io.to(`group_${groupId}_org_${orgId}`).emit('new_group_message', msgRes.rows[0]);
      } catch {}
    }
    for (const m of toRemove) {
      try {
        const msgRes = await pool.query(
          `INSERT INTO chat_group_messages (group_id, organization_id, username, message, message_type) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [groupId, orgId, 'SYSTEM', `${m} a fost eliminat din grup`, 'system']
        );
        io.to(`group_${groupId}_org_${orgId}`).emit('new_group_message', msgRes.rows[0]);
      } catch {}
    }

    res.json({ members: newMembers });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Mesajele unui grup (ultimele 100)
app.get('/api/chat/groups/:id/messages', authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const groupId = parseInt(req.params.id);
    // Verifică că userul e membru
    const memRes = await pool.query(
      `SELECT 1 FROM chat_group_members WHERE group_id=$1 AND username=$2 AND organization_id=$3`,
      [groupId, req.user.username, orgId]
    );
    if (memRes.rows.length === 0) return res.status(403).json({ error: 'Nu ești membru al acestui grup' });

    const result = await pool.query(
      `SELECT * FROM chat_group_messages WHERE group_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 100`,
      [groupId, orgId]
    );
    res.json(result.rows.reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trimite mesaj în grup
app.post('/api/chat/groups/:id/messages', authMiddleware, async (req, res) => {
  const { message, reply_to_id, reply_to_text, reply_to_username, image_data, image_type } = req.body;
  if (!message?.trim() && !image_data) return res.status(400).json({ error: 'Mesajul este gol' });
  const orgId = req.user.organization_id;
  const groupId = parseInt(req.params.id);
  const msgType = image_data ? 'image' : 'text';
  try {
    // Verifică că userul e membru
    const memRes = await pool.query(
      `SELECT 1 FROM chat_group_members WHERE group_id=$1 AND username=$2 AND organization_id=$3`,
      [groupId, req.user.username, orgId]
    );
    if (memRes.rows.length === 0) return res.status(403).json({ error: 'Nu ești membru al acestui grup' });

    const result = await pool.query(
      `INSERT INTO chat_group_messages (group_id, organization_id, username, message, reply_to_id, reply_to_text, reply_to_username, message_type, image_data, image_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [groupId, orgId, req.user.username, message?.trim() || '', reply_to_id || null, reply_to_text || null, reply_to_username || null, msgType, image_data || null, image_type || null]
    );
    const msg = result.rows[0];
    io.to(`group_${groupId}_org_${orgId}`).emit('new_group_message', msg);
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marchează grupul ca citit de userul curent
// Redenumire grup
app.put('/api/chat/groups/:id/name', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Interzis' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nume invalid' });
  const orgId = req.user.organization_id;
  const id = parseInt(req.params.id);
  try {
    const existing = await pool.query('SELECT name FROM chat_groups WHERE id=$1 AND organization_id=$2', [id, orgId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Grup negasit' });
    const newName = name.trim();
    await pool.query('UPDATE chat_groups SET name=$1 WHERE id=$2 AND organization_id=$3', [newName, id, orgId]);
    const msgRes = await pool.query(
      `INSERT INTO chat_group_messages (group_id, organization_id, username, message, message_type) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, orgId, 'SYSTEM', `${req.user.username} a redenumit grupul in "${newName}"`, 'system']
    );
    io.to(`group_${id}_org_${orgId}`).emit('group_renamed', { id, name: newName });
    io.to(`group_${id}_org_${orgId}`).emit('new_group_message', msgRes.rows[0]);
    res.json({ name: newName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chat/groups/:id/read', authMiddleware, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO chat_group_read (username, group_id, organization_id, last_read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (username, group_id) DO UPDATE SET last_read_at = NOW()`,
      [req.user.username, groupId, req.user.organization_id]
    );
    io.to(`group_${groupId}_org_${req.user.organization_id}`).emit('group_read_update', {
      groupId,
      username: req.user.username,
      lastReadAt: now
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Trimite comandă de transport (trip order) — DM sau grup
app.post('/api/chat/trip-order', authMiddleware, async (req, res) => {
  const { to, group_id, order_number, truck, payment_terms, doc_type, file_name, file_data, file_type } = req.body;
  if (!to && !group_id) return res.status(400).json({ error: 'Destinatar lipsă' });
  const msgData = JSON.stringify({ order_number, truck, payment_terms, doc_type, file_name, file_type, file_data });
  try {
    if (to) {
      const result = await pool.query(
        `INSERT INTO chat_messages (organization_id, username, receiver_username, message, message_type, trip_order_status)
         VALUES ($1, $2, $3, $4, 'trip_order', 'pending') RETURNING *`,
        [req.user.organization_id, req.user.username, to, msgData]
      );
      const msg = result.rows[0];
      const orgId = req.user.organization_id;
      io.to(`user_${to}_org_${orgId}`).emit('new_private_message', msg);
      io.to(`user_${req.user.username}_org_${orgId}`).emit('new_private_message', msg);
      res.json(msg);
    } else {
      const result = await pool.query(
        `INSERT INTO chat_group_messages (group_id, organization_id, username, message, message_type, trip_order_status)
         VALUES ($1, $2, $3, $4, 'trip_order', 'pending') RETURNING *`,
        [group_id, req.user.organization_id, req.user.username, msgData]
      );
      const msg = result.rows[0];
      io.to(`group_${group_id}_org_${req.user.organization_id}`).emit('new_group_message', msg);
      res.json(msg);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Răspunde la comandă de transport DM
app.put('/api/chat/messages/:id/trip-order-respond', authMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status invalid' });
  try {
    const msgResult = await pool.query(
      'SELECT * FROM chat_messages WHERE id=$1 AND organization_id=$2',
      [req.params.id, req.user.organization_id]
    );
    if (!msgResult.rows.length) return res.status(404).json({ error: 'Mesaj negăsit' });
    const origMsg = msgResult.rows[0];
    if (origMsg.receiver_username !== req.user.username) return res.status(403).json({ error: 'Interzis' });
    if (origMsg.trip_order_status !== 'pending') return res.status(400).json({ error: 'Deja răspuns' });
    const updated = await pool.query(
      'UPDATE chat_messages SET trip_order_status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    const updatedMsg = updated.rows[0];
    const orgId = req.user.organization_id;
    let orderData = {};
    try { orderData = JSON.parse(origMsg.message); } catch {}
    const actionText = status === 'accepted' ? 'a acceptat' : 'a refuzat';
    const notifText = `${req.user.username} ${actionText} comanda${orderData.order_number ? ' #' + orderData.order_number : ''}`;
    const sysResult = await pool.query(
      `INSERT INTO chat_messages (organization_id, username, receiver_username, message, message_type)
       VALUES ($1, $2, $3, $4, 'system') RETURNING *`,
      [orgId, req.user.username, origMsg.username, notifText]
    );
    const sysMsg = sysResult.rows[0];
    io.to(`user_${origMsg.username}_org_${orgId}`).emit('trip_order_updated', updatedMsg);
    io.to(`user_${req.user.username}_org_${orgId}`).emit('trip_order_updated', updatedMsg);
    io.to(`user_${origMsg.username}_org_${orgId}`).emit('new_private_message', sysMsg);
    io.to(`user_${req.user.username}_org_${orgId}`).emit('new_private_message', sysMsg);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Răspunde la comandă de transport grup
app.put('/api/chat/groups/:gid/messages/:id/trip-order-respond', authMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status invalid' });
  try {
    const msgResult = await pool.query(
      'SELECT * FROM chat_group_messages WHERE id=$1 AND group_id=$2 AND organization_id=$3',
      [req.params.id, req.params.gid, req.user.organization_id]
    );
    if (!msgResult.rows.length) return res.status(404).json({ error: 'Mesaj negăsit' });
    const origMsg = msgResult.rows[0];
    if (origMsg.trip_order_status !== 'pending') return res.status(400).json({ error: 'Deja răspuns' });
    const updated = await pool.query(
      'UPDATE chat_group_messages SET trip_order_status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    const updatedMsg = updated.rows[0];
    const orgId = req.user.organization_id;
    let orderData = {};
    try { orderData = JSON.parse(origMsg.message); } catch {}
    const actionText = status === 'accepted' ? 'a acceptat' : 'a refuzat';
    const notifText = `${req.user.username} ${actionText} comanda${orderData.order_number ? ' #' + orderData.order_number : ''}`;
    const sysResult = await pool.query(
      `INSERT INTO chat_group_messages (group_id, organization_id, username, message, message_type)
       VALUES ($1, $2, $3, $4, 'system') RETURNING *`,
      [req.params.gid, orgId, req.user.username, notifText]
    );
    const sysMsg = sysResult.rows[0];
    io.to(`group_${req.params.gid}_org_${orgId}`).emit('group_trip_order_updated', updatedMsg);
    io.to(`group_${req.params.gid}_org_${orgId}`).emit('new_group_message', sysMsg);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Editare mesaj DM (doar autorul, max 5 minute)
app.put('/api/chat/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Mesaj gol' });
    const check = await pool.query('SELECT * FROM chat_messages WHERE id=$1 AND username=$2 AND organization_id=$3', [req.params.id, req.user.username, req.user.organization_id]);
    if (!check.rows.length) return res.status(403).json({ error: 'Interzis' });
    if (Date.now() - new Date(check.rows[0].created_at).getTime() > 5 * 60 * 1000)
      return res.status(403).json({ error: 'Timpul de editare a expirat (5 minute)' });
    const result = await pool.query(
      `UPDATE chat_messages SET message=$1, edited_at=NOW() WHERE id=$2 RETURNING *`,
      [message.trim(), req.params.id]
    );
    const msg = result.rows[0];
    io.to(`org_${req.user.organization_id}`).emit('message_edited', msg);
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ștergere mesaj DM (soft-delete, doar autorul)
app.delete('/api/chat/messages/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE chat_messages SET is_deleted=TRUE WHERE id=$1 AND username=$2 AND organization_id=$3 RETURNING *`,
      [req.params.id, req.user.username, req.user.organization_id]
    );
    if (!result.rows.length) return res.status(403).json({ error: 'Interzis' });
    const msg = result.rows[0];
    const orgId = req.user.organization_id;
    io.to(`org_${orgId}`).emit('message_deleted', { id: msg.id, username: msg.username, receiver_username: msg.receiver_username });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Editare mesaj grup (doar autorul, max 5 minute)
app.put('/api/chat/groups/:gid/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Mesaj gol' });
    const check = await pool.query('SELECT * FROM chat_group_messages WHERE id=$1 AND username=$2 AND group_id=$3', [req.params.id, req.user.username, req.params.gid]);
    if (!check.rows.length) return res.status(403).json({ error: 'Interzis' });
    if (Date.now() - new Date(check.rows[0].created_at).getTime() > 5 * 60 * 1000)
      return res.status(403).json({ error: 'Timpul de editare a expirat (5 minute)' });
    const result = await pool.query(
      `UPDATE chat_group_messages SET message=$1, edited_at=NOW() WHERE id=$2 RETURNING *`,
      [message.trim(), req.params.id]
    );
    const msg = result.rows[0];
    io.to(`org_${req.user.organization_id}`).emit('group_message_edited', msg);
    res.json(msg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ștergere mesaj grup (soft-delete, doar autorul)
app.delete('/api/chat/groups/:gid/messages/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE chat_group_messages SET is_deleted=TRUE WHERE id=$1 AND username=$2 AND group_id=$3 RETURNING *`,
      [req.params.id, req.user.username, req.params.gid]
    );
    if (!result.rows.length) return res.status(403).json({ error: 'Interzis' });
    const msg = result.rows[0];
    io.to(`org_${req.user.organization_id}`).emit('group_message_deleted', { id: msg.id, group_id: msg.group_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pin/unpin DM message
app.put('/api/chat/messages/:id/pin', authMiddleware, async (req, res) => {
  try {
    const { is_pinned } = req.body;
    const result = await pool.query(
      'UPDATE chat_messages SET is_pinned=$1, pinned_by=$2 WHERE id=$3 AND organization_id=$4 RETURNING *',
      [is_pinned, is_pinned ? req.user.username : null, req.params.id, req.user.organization_id]
    );
    if (result.rows.length && is_pinned) {
      const msg = result.rows[0];
      const preview = msg.message?.slice(0, 40) + (msg.message?.length > 40 ? '…' : '');
      io.to(`org_${req.user.organization_id}`).emit('pin_notification', {
        text: `${req.user.username} a fixat un mesaj: „${preview}"`,
        context: 'dm', peer1: msg.username, peer2: msg.receiver_username,
      });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pin/unpin group message
app.put('/api/chat/groups/:gid/messages/:id/pin', authMiddleware, async (req, res) => {
  try {
    const { is_pinned } = req.body;
    const result = await pool.query(
      'UPDATE chat_group_messages SET is_pinned=$1, pinned_by=$2 WHERE id=$3 AND group_id=$4 RETURNING *',
      [is_pinned, is_pinned ? req.user.username : null, req.params.id, req.params.gid]
    );
    if (result.rows.length && is_pinned) {
      const msg = result.rows[0];
      const preview = msg.message?.slice(0, 40) + (msg.message?.length > 40 ? '…' : '');
      io.to(`org_${req.user.organization_id}`).emit('pin_notification', {
        text: `${req.user.username} a fixat un mesaj: „${preview}"`,
        context: 'group', groupId: Number(req.params.gid),
      });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Căutare globală mesaje ───────────────────────────────────
app.get('/api/chat/search', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const org = req.user.organization_id;
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ dm: [], groups: [] });

    const pattern = `%${q}%`;

    const dmRes = await pool.query(
      `SELECT id, message, username, receiver_username, created_at,
              'dm' AS type,
              CASE WHEN username=$1 THEN receiver_username ELSE username END AS peer
       FROM chat_messages
       WHERE organization_id=$2
         AND (username=$1 OR receiver_username=$1)
         AND is_deleted=FALSE
         AND (message_type IS NULL OR message_type='text')
         AND message ILIKE $3
       ORDER BY created_at DESC LIMIT 20`,
      [me, org, pattern]
    );

    const grpRes = await pool.query(
      `SELECT gm.id, gm.message, gm.username, gm.group_id, gm.created_at,
              'group' AS type, g.name AS group_name
       FROM chat_group_messages gm
       JOIN chat_group_members cgm ON cgm.group_id=gm.group_id AND cgm.username=$1
       JOIN chat_groups g ON g.id=gm.group_id
       WHERE gm.organization_id=$2
         AND gm.is_deleted=FALSE
         AND (gm.message_type IS NULL OR gm.message_type='text')
         AND gm.message ILIKE $3
       ORDER BY gm.created_at DESC LIMIT 20`,
      [me, org, pattern]
    );

    res.json({ dm: dmRes.rows, groups: grpRes.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AUTH ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = userResult.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
    }

    const permissions = JSON.parse(user.permissions || '{}');
    const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [user.organization_id]);
    const org = orgResult.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions,
        organization_id: user.organization_id,
        organization_name: org ? org.name : 'Fleet Management'
      },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      username: user.username,
      role: user.role,
      permissions,
      organization_name: org ? org.name : 'Fleet Management',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
    });
  } catch (err) {
    console.error('❌ POST /api/login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── REGISTER ────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { companyName, vat, email, username, password } = req.body;

    if (!companyName || !email || !username || !password) {
      return res.status(400).json({ error: 'Toate câmpurile sunt obligatorii' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Adresa de email nu este validă' });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username-ul trebuie să aibă cel puțin 3 caractere' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Parola trebuie să aibă cel puțin 6 caractere' });
    }

    // Verifică dacă username-ul sau email-ul există deja
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username.trim(), email.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username-ul sau email-ul există deja' });
    }

    // Creează organizația
    const orgResult = await pool.query(
      'INSERT INTO organizations (name, vat) VALUES ($1, $2) RETURNING id',
      [companyName.trim(), vat ? vat.trim() : null]
    );
    const orgId = orgResult.rows[0].id;

    // Creează utilizatorul admin cu toate permisiunile
    const hash = bcrypt.hashSync(password, 10);
    const perms = JSON.stringify(defaultPermissions.admin);

    const userResult = await pool.query(
      'INSERT INTO users (username, email, password, role, permissions, organization_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [username.trim(), email.trim(), hash, 'admin', perms, orgId]
    );

    // Token auto-login
    const permissions = defaultPermissions.admin;
    const token = jwt.sign(
      {
        id: userResult.rows[0].id,
        username: username.trim(),
        role: 'admin',
        permissions,
        organization_id: orgId,
        organization_name: companyName.trim()
      },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      username: username.trim(),
      role: 'admin',
      permissions,
      organization_name: companyName.trim()
    });
  } catch (err) {
    console.error('❌ POST /api/register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TRUCKS ──────────────────────────────────────────────────
app.get('/api/trucks', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trucks WHERE organization_id = $1 ORDER BY number ASC',
      [req.user.organization_id]
    );
    res.json(result.rows.map(t => ({
      ...t,
      vignettes: JSON.parse(t.vignettes || '[]'),
      next_trip: t.next_trip ? JSON.parse(t.next_trip) : null,
      amazon_account: t.amazon_account === 1,
      weekend_history: JSON.parse(t.weekend_history || '[]')
    })));
  } catch (err) {
    console.error('❌ GET /api/trucks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trucks', authMiddleware, async (req, res) => {
  try {
    const t = req.body;
    const result = await pool.query(`
      INSERT INTO trucks (
        number, status, client, order_number,
        load_location, load_date, load_lat, load_lng,
        unload_location, unload_date, unload_lat, unload_lng, eta,
        observations, pause_date, pause_time,
        weekend_duration, weekend_day, weekend_time, weekend_week, weekend_history,
        drivers, phone, trailer, fuel_card, fuel_card_expiry,
        amazon_account, vignettes, next_trip,
        file_name, file_data, file_type, vehicle_type, organization_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
      ) RETURNING id
    `, [
      t.number, t.status, t.client, t.order_number,
      t.load_location, t.load_date, t.load_lat, t.load_lng,
      t.unload_location, t.unload_date, t.unload_lat, t.unload_lng, t.eta,
      t.observations, t.pause_date, t.pause_time,
      t.weekend_duration, t.weekend_day, t.weekend_time, t.weekend_week,
      typeof t.weekend_history === 'string' ? t.weekend_history : JSON.stringify(t.weekend_history || []),
      t.drivers, t.phone, t.trailer, t.fuel_card, t.fuel_card_expiry,
      t.amazon_account, t.vignettes, t.next_trip,
      t.file_name, t.file_data, t.file_type, t.vehicle_type || null,
      req.user.organization_id
    ]);
    await addLog(req.user.organization_id, req.user.username, 'Adăugat camion', 'truck', result.rows[0].id, t.number);
    emitToOrg(req.user.organization_id, 'trucks_updated');
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('❌ POST /api/trucks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trucks/:id', authMiddleware, async (req, res) => {
  try {
    const t = req.body;
    await pool.query(`
      UPDATE trucks SET
        number=$1, status=$2, client=$3, order_number=$4,
        load_firm=$5, load_street=$6, load_location=$7, load_date=$8, load_eta=$9, load_lat=$10, load_lng=$11,
        unload_firm=$12, unload_street=$13, unload_location=$14, unload_date=$15, unload_lat=$16, unload_lng=$17,
        eta=$18, observations=$19, pause_date=$20, pause_time=$21,
        weekend_duration=$22, weekend_day=$23, weekend_time=$24, weekend_week=$25, weekend_history=$26,
        drivers=$27, phone=$28, trailer=$29, fuel_card=$30, fuel_card_expiry=$31,
        amazon_account=$32, vignettes=$33, next_trip=$34,
        file_name=$35, file_data=$36, file_type=$37, vehicle_type=$38,
        driver_1=$39, driver_2=$40, extra_stops=$41
      WHERE id=$42
    `, [
      t.number, t.status, t.client, t.order_number,
      t.load_firm ?? null, t.load_street ?? null, t.load_location, t.load_date, t.load_eta ?? null, t.load_lat, t.load_lng,
      t.unload_firm ?? null, t.unload_street ?? null, t.unload_location, t.unload_date, t.unload_lat, t.unload_lng,
      t.eta, t.observations, t.pause_date, t.pause_time,
      t.weekend_duration, t.weekend_day, t.weekend_time, t.weekend_week,
      typeof t.weekend_history === 'string' ? t.weekend_history : JSON.stringify(t.weekend_history || []),
      t.drivers, t.phone, t.trailer, t.fuel_card, t.fuel_card_expiry,
      t.amazon_account, t.vignettes, t.next_trip,
      t.file_name, t.file_data, t.file_type, t.vehicle_type || null,
      t.driver_1 || null, t.driver_2 || null,
      t.extra_stops ?? '[]',
      req.params.id
    ]);
    emitToOrg(req.user.organization_id, 'trucks_updated');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/trucks/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trucks/:id', authMiddleware, requirePermission('deleteTruckRow'), async (req, res) => {
  try {
    const truckResult = await pool.query('SELECT number FROM trucks WHERE id=$1', [req.params.id]);
    const truckNumber = truckResult.rows[0]?.number || req.params.id;
    await pool.query('DELETE FROM trucks WHERE id=$1', [req.params.id]);
    await addLog(req.user.organization_id, req.user.username, 'Șters camion', 'truck', req.params.id, truckNumber);
    emitToOrg(req.user.organization_id, 'trucks_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/trucks/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TRIPS ───────────────────────────────────────────────────
app.get('/api/trips', authMiddleware, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin' || req.user.role === 'contabil') {
      result = await pool.query(
        'SELECT * FROM trips WHERE organization_id = $1 ORDER BY created_at DESC',
        [req.user.organization_id]
      );
    } else {
      result = await pool.query(
        'SELECT * FROM trips WHERE organization_id = $1 AND created_by = $2 ORDER BY created_at DESC',
        [req.user.organization_id, req.user.username]
      );
    }
    res.json(result.rows.map(t => ({ ...t, invoiced: t.invoiced === 1 })));
  } catch (err) {
    console.error('❌ GET /api/trips error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trips', authMiddleware, requirePermission('addTrip'), async (req, res) => {
  try {
    const t = req.body;
    const result = await pool.query(`
      INSERT INTO trips (
        client, order_number, load_date, unload_date,
        load_firm, load_street, load_location, unload_firm, unload_street, unload_location,
        price, km_empty, km_loaded, tolls, truck_number, driver,
        invoiced, file_name, file_data, file_type, load_coords, unload_coords,
        cmr_file_name, cmr_file_data, cmr_file_type,
        invoice_file_name, invoice_file_data, invoice_file_type,
        created_by, organization_id, extra_stops
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
      ) RETURNING id
    `, [
      t.client, t.order_number, t.load_date, t.unload_date,
      t.load_firm ?? null, t.load_street ?? null, t.load_location, t.unload_firm ?? null, t.unload_street ?? null, t.unload_location,
      t.price, t.km_empty, t.km_loaded, t.tolls,
      t.truck_number, t.driver,
      t.invoiced ? 1 : 0,
      t.file_name, t.file_data, t.file_type,
      t.load_coords, t.unload_coords,
      null, null, null, null, null, null,
      req.user.username,
      req.user.organization_id,
      t.extra_stops ?? '[]'
    ]);
    await addLog(req.user.organization_id, req.user.username, 'Adăugat cursă', 'trip', result.rows[0].id, `${t.client || ''} / ${t.truck_number || ''}`);
    emitToOrg(req.user.organization_id, 'trips_updated');
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('❌ POST /api/trips error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trips/:id', authMiddleware, requirePermission('editTrip'), async (req, res) => {
  try {
    const t = req.body;
    await pool.query(`
      UPDATE trips SET
        client=$1, order_number=$2, load_date=$3, unload_date=$4,
        load_firm=$5, load_street=$6, load_location=$7,
        unload_firm=$8, unload_street=$9, unload_location=$10,
        price=$11, km_empty=$12, km_loaded=$13, tolls=$14,
        truck_number=$15, driver=$16, invoiced=$17,
        file_name=$18, file_data=$19, file_type=$20,
        load_coords=$21, unload_coords=$22,
        cmr_file_name=$23, cmr_file_data=$24, cmr_file_type=$25,
        invoice_file_name=$26, invoice_file_data=$27, invoice_file_type=$28,
        extra_stops=$29, completed=$30
      WHERE id=$31
    `, [
      t.client, t.order_number, t.load_date, t.unload_date,
      t.load_firm ?? null, t.load_street ?? null, t.load_location ?? null,
      t.unload_firm ?? null, t.unload_street ?? null, t.unload_location ?? null,
      t.price ?? null, t.km_empty ?? null, t.km_loaded ?? null, t.tolls ?? null,
      t.truck_number, t.driver,
      t.invoiced ? 1 : 0,
      t.file_name ?? null, t.file_data ?? null, t.file_type ?? null,
      t.load_coords ?? null, t.unload_coords ?? null,
      t.cmr_file_name ?? null, t.cmr_file_data ?? null, t.cmr_file_type ?? null,
      t.invoice_file_name ?? null, t.invoice_file_data ?? null, t.invoice_file_type ?? null,
      t.extra_stops ?? '[]',
      t.completed ? 1 : 0,
      req.params.id
    ]);
    emitToOrg(req.user.organization_id, 'trips_updated');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/trips/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trips/:id', authMiddleware, requirePermission('deleteTrip'), async (req, res) => {
  try {
    const tripResult = await pool.query('SELECT client, truck_number FROM trips WHERE id=$1', [req.params.id]);
    const trip = tripResult.rows[0];
    await pool.query('DELETE FROM trips WHERE id=$1', [req.params.id]);
    await addLog(req.user.organization_id, req.user.username, 'Șters cursă', 'trip', req.params.id, trip ? `${trip.client || ''} / ${trip.truck_number || ''}` : null);
    emitToOrg(req.user.organization_id, 'trips_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/trips/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── USERS ────────────────────────────────────────────────────
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && !req.user.permissions?.accessUsers) return res.status(403).json({ error: 'Acces interzis' });
    const result = await pool.query(
      'SELECT id, username, role, role_id, permissions, first_name, last_name FROM users WHERE organization_id = $1',
      [req.user.organization_id]
    );
    res.json(result.rows.map(u => ({
      ...u,
      permissions: JSON.parse(u.permissions || '{}')
    })));
  } catch (err) {
    console.error('❌ GET /api/users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && !req.user.permissions?.accessUsers) return res.status(403).json({ error: 'Acces interzis' });
    const { username, password, role, role_id, permissions, first_name, last_name } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const perms = JSON.stringify(permissions || {});
    await pool.query(
      'INSERT INTO users (username, password, role, role_id, permissions, organization_id, first_name, last_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [username, hash, role || 'dispatcher', role_id || null, perms, req.user.organization_id, first_name || null, last_name || null]
    );
    await addLog(req.user.organization_id, req.user.username, 'Adăugat utilizator', 'user', null, `${username} (${role})`);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Username deja existent' });
  }
});

app.put('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && !req.user.permissions?.accessUsers) return res.status(403).json({ error: 'Acces interzis' });
    const { password, role, role_id, permissions, first_name, last_name } = req.body;
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        'UPDATE users SET password=$1, role=$2, role_id=$3, permissions=$4, first_name=$6, last_name=$7 WHERE id=$5',
        [hash, role || 'dispatcher', role_id || null, JSON.stringify(permissions || {}), req.params.id, first_name || null, last_name || null]
      );
    } else {
      await pool.query(
        'UPDATE users SET role=$1, role_id=$2, permissions=$3, first_name=$5, last_name=$6 WHERE id=$4',
        [role || 'dispatcher', role_id || null, JSON.stringify(permissions || {}), req.params.id, first_name || null, last_name || null]
      );
    }
    await addLog(req.user.organization_id, req.user.username, 'Editat utilizator', 'user', req.params.id, `rol: ${role}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/users/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && !req.user.permissions?.accessUsers) return res.status(403).json({ error: 'Acces interzis' });
    const userResult = await pool.query('SELECT organization_id, username FROM users WHERE id = $1', [req.params.id]);
    const user = userResult.rows[0];
    if (!user || user.organization_id !== req.user.organization_id) {
      return res.status(403).json({ error: 'Acces interzis' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await addLog(req.user.organization_id, req.user.username, 'Șters utilizator', 'user', req.params.id, user.username);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ DELETE /api/users/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── LOGGING ─────────────────────────────────────────────────
async function addLog(organizationId, username, action, entityType, entityId, details) {
  try {
    await pool.query(
      `INSERT INTO logs (username, action, entity_type, entity_id, details, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [username, action, entityType, entityId ? String(entityId) : null, details || null, organizationId]
    );
  } catch (err) {
    console.error('⚠ Eroare log:', err.message);
  }
}

app.get('/api/logs', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && !req.user.permissions?.accessLogs) return res.status(403).json({ error: 'Acces interzis' });
    const result = await pool.query(
      `SELECT * FROM logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 500`,
      [req.user.organization_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/logs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DRIVERS ─────────────────────────────────────────────────
app.get('/api/drivers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
        COALESCE(json_agg(
          json_build_object(
            'id', dd.id, 'doc_type', dd.doc_type,
            'file_name', dd.file_name, 'file_type', dd.file_type,
            'expiry_date', dd.expiry_date
          )
        ) FILTER (WHERE dd.id IS NOT NULL), '[]') AS documents
       FROM drivers d
       LEFT JOIN driver_documents dd ON dd.driver_id = d.id
       WHERE d.organization_id = $1
       GROUP BY d.id
       ORDER BY d.name`,
      [req.user.organization_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/drivers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { first_name, last_name, hire_date, is_active, amazon_account } = req.body;
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || '';
    const result = await pool.query(
      `INSERT INTO drivers (name, first_name, last_name, hire_date, is_active, amazon_account, organization_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [fullName, first_name || null, last_name || null, hire_date || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, amazon_account ? 1 : 0, req.user.organization_id]
    );
    await addLog(req.user.organization_id, req.user.username, 'Adăugat șofer', 'driver', result.rows[0].id, fullName);
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('❌ POST /api/drivers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/drivers/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { first_name, last_name, hire_date, is_active, amazon_account } = req.body;
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || '';
    await pool.query(
      `UPDATE drivers SET name=$1, first_name=$2, last_name=$3, hire_date=$4, is_active=$5, amazon_account=$6 WHERE id=$7`,
      [fullName, first_name || null, last_name || null, hire_date || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, amazon_account ? 1 : 0, req.params.id]
    );
    await addLog(req.user.organization_id, req.user.username, 'Editat șofer', 'driver', req.params.id, fullName);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/drivers/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Toggle amazon_account per șofer (acces rapid fără a trimite toate câmpurile)
app.put('/api/drivers/:id/amazon', authMiddleware, async (req, res) => {
  try {
    let perms = {};
    try { perms = JSON.parse(req.user.permissions || '{}'); } catch {}
    if (req.user.role !== 'admin' && !perms.toggleAmazon) {
      return res.status(403).json({ error: 'Acces interzis' });
    }
    const { amazon_account } = req.body;
    await pool.query(
      `UPDATE drivers SET amazon_account=$1 WHERE id=$2 AND organization_id=$3`,
      [amazon_account ? 1 : 0, req.params.id, req.user.organization_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/drivers/:id/amazon error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Atribuire camion la șofer — sincronizează driver_1/driver_2 pe trucks
app.put('/api/drivers/:id/truck', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
  const { truck_number } = req.body;
  const driverId = req.params.id;
  const orgId = req.user.organization_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Info șofer curent
    const drRes = await client.query('SELECT * FROM drivers WHERE id=$1 AND organization_id=$2', [driverId, orgId]);
    if (drRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Șofer negăsit' }); }
    const driver = drRes.rows[0];
    const driverName = [driver.first_name, driver.last_name].filter(Boolean).join(' ') || driver.name;
    const oldTruck = driver.assigned_truck;

    // Elimină din camionul vechi
    if (oldTruck) {
      const trRes = await client.query('SELECT * FROM trucks WHERE number=$1 AND organization_id=$2', [oldTruck, orgId]);
      if (trRes.rows.length > 0) {
        const t = trRes.rows[0];
        const d1 = t.driver_1 === driverName ? null : t.driver_1;
        const d2 = t.driver_2 === driverName ? null : t.driver_2;
        const driversStr = [d1, d2].filter(Boolean).join(', ');
        await client.query('UPDATE trucks SET driver_1=$1, driver_2=$2, drivers=$3 WHERE number=$4 AND organization_id=$5',
          [d1, d2, driversStr, oldTruck, orgId]);
      }
    }

    // Adaugă pe noul camion
    if (truck_number) {
      const trRes = await client.query('SELECT * FROM trucks WHERE number=$1 AND organization_id=$2', [truck_number, orgId]);
      if (trRes.rows.length > 0) {
        const t = trRes.rows[0];
        let d1 = t.driver_1;
        let d2 = t.driver_2;
        if (!d1 || d1 === driverName) {
          d1 = driverName;
        } else if (!d2 || d2 === driverName) {
          d2 = driverName;
        } else {
          d2 = driverName; // înlocuiește al doilea dacă ambele sunt ocupate
        }
        const driversStr = [d1, d2].filter(Boolean).join(', ');
        await client.query('UPDATE trucks SET driver_1=$1, driver_2=$2, drivers=$3 WHERE number=$4 AND organization_id=$5',
          [d1, d2, driversStr, truck_number, orgId]);
      }
    }

    // Actualizează assigned_truck pe șofer
    await client.query('UPDATE drivers SET assigned_truck=$1 WHERE id=$2', [truck_number || null, driverId]);

    await client.query('COMMIT');
    emitToOrg(req.user.organization_id, 'trucks_updated');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ PUT /api/drivers/:id/truck error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/drivers/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const driverResult = await pool.query(`SELECT name FROM drivers WHERE id=$1`, [req.params.id]);
    const driverName = driverResult.rows[0]?.name || req.params.id;
    await pool.query(`DELETE FROM drivers WHERE id=$1`, [req.params.id]);
    await addLog(req.user.organization_id, req.user.username, 'Șters șofer', 'driver', req.params.id, driverName);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/drivers/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DRIVER DOCUMENTS ────────────────────────────────────────
app.get('/api/driver-documents/:driverId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM driver_documents WHERE driver_id = $1 ORDER BY doc_type`,
      [req.params.driverId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/driver-documents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/driver-documents', authMiddleware, async (req, res) => {
  try {
    const { driver_id, doc_type, file_name, file_data, file_type, expiry_date } = req.body;
    const result = await pool.query(
      `INSERT INTO driver_documents (driver_id, doc_type, file_name, file_data, file_type, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [driver_id, doc_type, file_name, file_data, file_type, expiry_date || null]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('❌ POST /api/driver-documents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/driver-documents/:id', authMiddleware, async (req, res) => {
  try {
    const { doc_type, file_name, file_data, file_type, expiry_date } = req.body;
    await pool.query(
      `UPDATE driver_documents SET doc_type=$1, file_name=$2, file_data=$3, file_type=$4, expiry_date=$5 WHERE id=$6`,
      [doc_type, file_name, file_data, file_type, expiry_date || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/driver-documents/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/driver-documents/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM driver_documents WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/driver-documents/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TRUCK DOCUMENTS ─────────────────────────────────────────
app.get('/api/truck-documents/:truckId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM truck_documents WHERE truck_id = $1 ORDER BY doc_type`,
      [req.params.truckId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/truck-documents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/truck-documents', authMiddleware, async (req, res) => {
  try {
    const { truck_id, doc_type, file_name, file_data, file_type, expiry_date } = req.body;
    const result = await pool.query(
      `INSERT INTO truck_documents (truck_id, doc_type, file_name, file_data, file_type, expiry_date, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [truck_id, doc_type, file_name, file_data, file_type, expiry_date || null, req.user.organization_id]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('❌ POST /api/truck-documents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/truck-documents/:id', authMiddleware, async (req, res) => {
  try {
    const { doc_type, file_name, file_data, file_type, expiry_date } = req.body;
    await pool.query(
      `UPDATE truck_documents SET doc_type=$1, file_name=$2, file_data=$3, file_type=$4, expiry_date=$5 WHERE id=$6`,
      [doc_type, file_name, file_data, file_type, expiry_date || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/truck-documents/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/truck-documents/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(`DELETE FROM truck_documents WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/truck-documents/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── ALERTE DOCUMENTE ─────────────────────────────────────────
app.get('/api/alerts/documents', authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `SELECT 'driver' AS type,
              TRIM(CONCAT(COALESCE(d.first_name,''), ' ', COALESCE(d.last_name,''), ' (', d.name, ')')) AS entity_name,
              dd.doc_type, dd.expiry_date, d.id AS entity_id
       FROM driver_documents dd
       JOIN drivers d ON d.id = dd.driver_id
       WHERE d.organization_id = $1
         AND dd.expiry_date IS NOT NULL AND dd.expiry_date != ''
         AND dd.expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'

       UNION ALL

       SELECT 'truck' AS type, t.number AS entity_name,
              td.doc_type, td.expiry_date, t.id AS entity_id
       FROM truck_documents td
       JOIN trucks t ON t.id = td.truck_id
       WHERE td.organization_id = $1
         AND td.expiry_date IS NOT NULL AND td.expiry_date != ''
         AND td.expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'

       UNION ALL

       SELECT 'trailer' AS type, tr.number AS entity_name,
              'ITP' AS doc_type, tr.itp_expiry AS expiry_date, tr.id AS entity_id
       FROM trailers tr
       WHERE tr.organization_id = $1
         AND tr.itp_expiry IS NOT NULL AND tr.itp_expiry != ''
         AND tr.itp_expiry::date <= CURRENT_DATE + INTERVAL '30 days'

       UNION ALL

       SELECT 'trailer' AS type, tr.number AS entity_name,
              'RCA' AS doc_type, tr.rca_expiry AS expiry_date, tr.id AS entity_id
       FROM trailers tr
       WHERE tr.organization_id = $1
         AND tr.rca_expiry IS NOT NULL AND tr.rca_expiry != ''
         AND tr.rca_expiry::date <= CURRENT_DATE + INTERVAL '30 days'

       ORDER BY expiry_date ASC`,
      [orgId]
    );
    const now = new Date();
    const alerts = result.rows.map(r => ({
      ...r,
      days_left: Math.ceil((new Date(r.expiry_date) - now) / (1000 * 60 * 60 * 24)),
    }));
    res.json(alerts);
  } catch (err) {
    console.error('❌ GET /api/alerts/documents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TRAILERS ────────────────────────────────────────────────
app.get('/api/trailers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM trailers WHERE organization_id = $1 ORDER BY number ASC`,
      [req.user.organization_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/trailers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trailers', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { number, type, status, current_truck, itp_expiry, rca_expiry, observations } = req.body;
    if (!number?.trim()) return res.status(400).json({ error: 'Numărul remorcii este obligatoriu' });
    const result = await pool.query(
      `INSERT INTO trailers (number, type, status, current_truck, itp_expiry, rca_expiry, observations, organization_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [number.trim(), type||null, status||'libera', current_truck||null, itp_expiry||null, rca_expiry||null, observations||null, req.user.organization_id]
    );
    await addLog(req.user.organization_id, req.user.username, 'Adăugat remorcă', 'trailer', result.rows[0].id, number.trim());
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('❌ POST /api/trailers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/trailers/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { number, type, status, current_truck, itp_expiry, rca_expiry, observations } = req.body;
    const orgId = req.user.organization_id;

    // Get old current_truck before updating
    const oldRow = await pool.query(`SELECT current_truck FROM trailers WHERE id=$1 AND organization_id=$2`, [req.params.id, orgId]);
    const oldTruck = oldRow.rows[0]?.current_truck || null;
    const newTruck = current_truck || null;

    await pool.query(
      `UPDATE trailers SET number=$1, type=$2, status=$3, current_truck=$4, itp_expiry=$5, rca_expiry=$6, observations=$7
       WHERE id=$8 AND organization_id=$9`,
      [number, type||null, status||'libera', newTruck, itp_expiry||null, rca_expiry||null, observations||null, req.params.id, orgId]
    );

    // Sync truck's trailer field
    if (oldTruck && oldTruck !== newTruck) {
      // Clear old truck's trailer field
      await pool.query(`UPDATE trucks SET trailer=NULL WHERE number=$1 AND organization_id=$2`, [oldTruck, orgId]);
    }
    if (newTruck && newTruck !== oldTruck) {
      // Set new truck's trailer field
      await pool.query(`UPDATE trucks SET trailer=$1 WHERE number=$2 AND organization_id=$3`, [number, newTruck, orgId]);
    }
    if (newTruck && newTruck === oldTruck) {
      // Same truck, but trailer number may have changed - keep in sync
      await pool.query(`UPDATE trucks SET trailer=$1 WHERE number=$2 AND organization_id=$3`, [number, newTruck, orgId]);
    }

    await addLog(orgId, req.user.username, 'Editat remorcă', 'trailer', req.params.id, number);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ PUT /api/trailers/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trailers/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const tr = await pool.query(`SELECT number FROM trailers WHERE id=$1 AND organization_id=$2`, [req.params.id, req.user.organization_id]);
    const num = tr.rows[0]?.number || req.params.id;
    await pool.query(`DELETE FROM trailers WHERE id=$1 AND organization_id=$2`, [req.params.id, req.user.organization_id]);
    await addLog(req.user.organization_id, req.user.username, 'Șters remorcă', 'trailer', req.params.id, num);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/trailers/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── ROLES ────────────────────────────────────────────────────
app.get('/api/roles', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM roles WHERE organization_id=$1 ORDER BY is_system DESC, name ASC`,
      [req.user.organization_id]
    );
    res.json(result.rows.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '{}') })));
  } catch (err) {
    console.error('❌ GET /api/roles error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/roles', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { name, color, permissions } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Numele rolului este obligatoriu' });
    const result = await pool.query(
      `INSERT INTO roles (name, color, permissions, organization_id, is_system) VALUES ($1, $2, $3, $4, FALSE) RETURNING *`,
      [name.trim(), color || '#6b7280', JSON.stringify(permissions || {}), req.user.organization_id]
    );
    await addLog(req.user.organization_id, req.user.username, 'Adăugat rol', 'role', result.rows[0].id, name);
    res.json({ ...result.rows[0], permissions: permissions || {} });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Există deja un rol cu acest nume' });
    console.error('❌ POST /api/roles error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/roles/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { name, color, permissions } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Numele rolului este obligatoriu' });
    await pool.query(
      `UPDATE roles SET name=$1, color=$2, permissions=$3 WHERE id=$4 AND organization_id=$5`,
      [name.trim(), color || '#6b7280', JSON.stringify(permissions || {}), req.params.id, req.user.organization_id]
    );
    await addLog(req.user.organization_id, req.user.username, 'Editat rol', 'role', req.params.id, name);
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Există deja un rol cu acest nume' });
    console.error('❌ PUT /api/roles/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/roles/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const role = await pool.query(`SELECT name, is_system FROM roles WHERE id=$1 AND organization_id=$2`, [req.params.id, req.user.organization_id]);
    if (!role.rows[0]) return res.status(404).json({ error: 'Rol negăsit' });
    if (role.rows[0].is_system) return res.status(400).json({ error: 'Rolurile de sistem nu pot fi șterse' });
    await pool.query(`DELETE FROM roles WHERE id=$1 AND organization_id=$2`, [req.params.id, req.user.organization_id]);
    await addLog(req.user.organization_id, req.user.username, 'Șters rol', 'role', req.params.id, role.rows[0].name);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/roles/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DASHBOARD / RAPOARTE ────────────────────────────────────
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { from, to, truck, driver } = req.query;

    // Construiește filtrele dinamice
    const baseParams = [orgId];
    const baseConditions = ['organization_id = $1'];
    if (from)   { baseParams.push(from);   baseConditions.push(`created_at >= $${baseParams.length}`); }
    if (to)     { baseParams.push(to);     baseConditions.push(`created_at <= $${baseParams.length}`); }
    if (truck)  { baseParams.push(truck);  baseConditions.push(`truck_number = $${baseParams.length}`); }
    if (driver) { baseParams.push(driver); baseConditions.push(`driver = $${baseParams.length}`); }
    const baseWhere = baseConditions.join(' AND ');

    // A. Carduri sumar
    const summaryRes = await pool.query(
      `SELECT
         COUNT(*)                                                    AS total_trips,
         COALESCE(SUM(price), 0)                                     AS total_revenue,
         COALESCE(SUM(km_loaded), 0)                                 AS total_km_loaded,
         COALESCE(SUM(km_empty), 0)                                  AS total_km_empty,
         COALESCE(SUM(tolls), 0)                                     AS total_tolls,
         COUNT(*) FILTER (WHERE invoiced = 0)                        AS uninvoiced_count,
         COALESCE(SUM(price) FILTER (WHERE invoiced = 0), 0)         AS uninvoiced_revenue
       FROM trips WHERE ${baseWhere}`,
      baseParams
    );

    // B. Curse per săptămână (ultimele 8 săptămâni, ignoră filtrele de dată)
    const weekParams = [orgId];
    const weekConditions = ['organization_id = $1', `created_at >= NOW() - INTERVAL '8 weeks'`];
    if (truck)  { weekParams.push(truck);  weekConditions.push(`truck_number = $${weekParams.length}`); }
    if (driver) { weekParams.push(driver); weekConditions.push(`driver = $${weekParams.length}`); }
    const weeklyRes = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('week', created_at), 'DD.MM') AS week_label,
              DATE_TRUNC('week', created_at) AS week_start,
              COUNT(*) AS trips,
              COALESCE(SUM(price), 0) AS revenue
       FROM trips WHERE ${weekConditions.join(' AND ')}
       GROUP BY week_start, week_label ORDER BY week_start`,
      weekParams
    );

    // C. Venituri per lună (ultimele 12 luni, ignoră filtrele de dată)
    const monthParams = [orgId];
    const monthConditions = ['organization_id = $1', `created_at >= NOW() - INTERVAL '12 months'`];
    if (truck)  { monthParams.push(truck);  monthConditions.push(`truck_number = $${monthParams.length}`); }
    if (driver) { monthParams.push(driver); monthConditions.push(`driver = $${monthParams.length}`); }
    const monthlyRes = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'MM.YYYY') AS month_label,
              DATE_TRUNC('month', created_at) AS month_start,
              COUNT(*) AS trips,
              COALESCE(SUM(price), 0) AS revenue
       FROM trips WHERE ${monthConditions.join(' AND ')}
       GROUP BY month_start, month_label ORDER BY month_start`,
      monthParams
    );

    // D. Top camioane (după venituri)
    const truckParams = [orgId];
    const truckConditions = ['organization_id = $1', `truck_number IS NOT NULL`, `truck_number != ''`];
    if (from)   { truckParams.push(from);   truckConditions.push(`created_at >= $${truckParams.length}`); }
    if (to)     { truckParams.push(to);     truckConditions.push(`created_at <= $${truckParams.length}`); }
    if (driver) { truckParams.push(driver); truckConditions.push(`driver = $${truckParams.length}`); }
    const topTrucksRes = await pool.query(
      `SELECT truck_number, COUNT(*) AS trips,
              COALESCE(SUM(price), 0) AS revenue,
              COALESCE(SUM(km_loaded), 0) AS km
       FROM trips WHERE ${truckConditions.join(' AND ')}
       GROUP BY truck_number ORDER BY revenue DESC LIMIT 8`,
      truckParams
    );

    // E. Curse nefacturate (detaliat)
    const uninvParams = [orgId];
    const uninvConditions = ['organization_id = $1', 'invoiced = 0'];
    if (from)   { uninvParams.push(from);   uninvConditions.push(`created_at >= $${uninvParams.length}`); }
    if (to)     { uninvParams.push(to);     uninvConditions.push(`created_at <= $${uninvParams.length}`); }
    if (truck)  { uninvParams.push(truck);  uninvConditions.push(`truck_number = $${uninvParams.length}`); }
    if (driver) { uninvParams.push(driver); uninvConditions.push(`driver = $${uninvParams.length}`); }
    const uninvoicedRes = await pool.query(
      `SELECT id, client, order_number, truck_number, driver,
              load_date, unload_date, load_location, unload_location, price
       FROM trips WHERE ${uninvConditions.join(' AND ')}
       ORDER BY created_at DESC`,
      uninvParams
    );

    res.json({
      summary:        summaryRes.rows[0],
      weeklyTrips:    weeklyRes.rows,
      monthlyRevenue: monthlyRes.rows,
      topTrucks:      topTrucksRes.rows,
      uninvoiced:     uninvoicedRes.rows,
    });
  } catch (err) {
    console.error('❌ GET /api/dashboard/stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GENERARE COMANDĂ — extragere AI din PDF ─────────────────
app.post('/api/extract-order', authMiddleware, async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'Lipsește PDF-ul' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY lipsește din .env' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey });

    const prompt = `Ești un asistent care extrage informații dintr-o comandă de transport.
Analizează documentul PDF și extrage EXACT următoarele câmpuri, returnând UN SINGUR OBIECT JSON valid:

{
  "order_number": "numărul comenzii",
  "client": "numele clientului/expeditorului comenzii (firma care a emis comanda, NU firmele de încărcare/descărcare)",
  "load_date": "data încărcării în format DD.MM.YYYY",
  "load_time": "ora încărcării în format HH:MM",
  "load_company": "numele firmei/depozitului de la locul de ÎNCĂRCARE (Loading Address)",
  "load_street": "strada, numărul sau zona industrială de la locul de ÎNCĂRCARE",
  "load_city": "țara (abreviere ISO), codul poștal și orașul de la locul de ÎNCĂRCARE (ex: CZ, 796 01 PROSTEJOV)",
  "load_coords": "coordonate GPS încărcare în format \"lat, lng\" cu 6 zecimale (ex: 49.472345, 17.121456)",
  "load_details": "detalii marfă/încărcare (tip marfă, greutate, paleți, etc.)",
  "load_ref": "referința/numărul de referință de încărcare dacă există",
  "unload_date": "data descărcării în format DD.MM.YYYY",
  "unload_time": "ora descărcării în format HH:MM",
  "unload_company": "numele firmei/depozitului de la locul de DESCĂRCARE (Delivery Address)",
  "unload_street": "strada, numărul sau zona industrială de la locul de DESCĂRCARE",
  "unload_city": "țara (abreviere ISO), codul poștal și orașul de la locul de DESCĂRCARE (ex: RO, 115400 MIOVENI)",
  "unload_coords": "coordonate GPS descărcare în format \"lat, lng\" cu 6 zecimale (ex: 44.923456, 24.873456)",
  "unload_ref": "referința/numărul de referință de descărcare dacă există"
}

Reguli CRITICE:
- ATENȚIE MAXIMĂ la distincția Loading Address (încărcare) vs Delivery Address (descărcare) — NU le inversa!
- Loading Address = locul de unde se ridică marfa; Delivery Address = locul unde se livrează marfa
- Returnează DOAR JSON-ul, fără text suplimentar, fără markdown
- Dacă un câmp nu există în document, lasă-l string gol ""
- Datele să fie în formatul specificat (DD.MM.YYYY pentru date, HH:MM pentru ore)
- Pentru coordonate GPS: dacă sunt scrise explicit în PDF folosește-le, altfel DEDUCE-LE din adresă folosind cunoștințele tale geografice. Folosește coordonate precise pentru orașul/strada respectivă (6 zecimale, format \"lat, lng\"). Nu lăsa coordonatele goale dacă ai adresa.`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const raw = response.content[0].text.trim();
    // Curăță markdown dacă modelul a pus ```json
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleaned);
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ extract-order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── SPA fallback (React Router) ─────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ── START ───────────────────────────────────────────────────
initDb()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`✓ Server pornit la http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Eroare inițializare DB:', err);
    process.exit(1);
  });
