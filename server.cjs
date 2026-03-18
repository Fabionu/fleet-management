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
    const result = await pool.query(
      `SELECT username, role, first_name, last_name FROM users WHERE organization_id = $1 AND username != $2 ORDER BY username`,
      [req.user.organization_id, req.user.username]
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
  const { to, message } = req.body;
  if (!to || !message?.trim()) return res.status(400).json({ error: 'Date lipsă' });
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages (organization_id, username, receiver_username, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.organization_id, req.user.username, to, message.trim()]
    );
    const msg = result.rows[0];
    const orgId = req.user.organization_id;
    // Emit în camerele private ale ambelor părți (suport multi-tab)
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
         array_agg(gm2.username ORDER BY gm2.username) AS members
       FROM chat_groups g
       JOIN chat_group_members gm ON gm.group_id = g.id AND gm.username = $1
       JOIN chat_group_members gm2 ON gm2.group_id = g.id
       WHERE g.organization_id = $2
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [me, orgId]
    );
    // Include member read times for seen indicators
    for (const group of result.rows) {
      const readsRes = await pool.query(
        'SELECT username, last_read_at FROM chat_group_read WHERE group_id=$1 AND organization_id=$2',
        [group.id, orgId]
      );
      group.memberReads = readsRes.rows;
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
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Mesajul este gol' });
  const orgId = req.user.organization_id;
  const groupId = parseInt(req.params.id);
  try {
    // Verifică că userul e membru
    const memRes = await pool.query(
      `SELECT 1 FROM chat_group_members WHERE group_id=$1 AND username=$2 AND organization_id=$3`,
      [groupId, req.user.username, orgId]
    );
    if (memRes.rows.length === 0) return res.status(403).json({ error: 'Nu ești membru al acestui grup' });

    const result = await pool.query(
      `INSERT INTO chat_group_messages (group_id, organization_id, username, message) VALUES ($1, $2, $3, $4) RETURNING *`,
      [groupId, orgId, req.user.username, message.trim()]
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
      organization_name: org ? org.name : 'Fleet Management'
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
        driver_1=$39, driver_2=$40
      WHERE id=$41
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
        created_by, organization_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
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
      req.user.organization_id
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
        invoice_file_name=$26, invoice_file_data=$27, invoice_file_type=$28
      WHERE id=$29
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

// ── USERS (doar admin) ──────────────────────────────────────
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const result = await pool.query(
      'SELECT id, username, role, permissions, first_name, last_name FROM users WHERE organization_id = $1',
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
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { username, password, role, permissions, first_name, last_name } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const perms = JSON.stringify(permissions || {});
    await pool.query(
      'INSERT INTO users (username, password, role, permissions, organization_id, first_name, last_name) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [username, hash, role, perms, req.user.organization_id, first_name || null, last_name || null]
    );
    await addLog(req.user.organization_id, req.user.username, 'Adăugat utilizator', 'user', null, `${username} (${role})`);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Username deja existent' });
  }
});

app.put('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
    const { password, role, permissions, first_name, last_name } = req.body;
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        'UPDATE users SET password=$1, role=$2, permissions=$3, first_name=$5, last_name=$6 WHERE id=$4',
        [hash, role, JSON.stringify(permissions || {}), req.params.id, first_name || null, last_name || null]
      );
    } else {
      await pool.query(
        'UPDATE users SET role=$1, permissions=$2, first_name=$4, last_name=$5 WHERE id=$3',
        [role, JSON.stringify(permissions || {}), req.params.id, first_name || null, last_name || null]
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
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
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
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
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
    await pool.query(
      `UPDATE trailers SET number=$1, type=$2, status=$3, current_truck=$4, itp_expiry=$5, rca_expiry=$6, observations=$7
       WHERE id=$8 AND organization_id=$9`,
      [number, type||null, status||'libera', current_truck||null, itp_expiry||null, rca_expiry||null, observations||null, req.params.id, req.user.organization_id]
    );
    await addLog(req.user.organization_id, req.user.username, 'Editat remorcă', 'trailer', req.params.id, number);
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
