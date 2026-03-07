require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { pool, defaultPermissions, initDb } = require('./database/db.cjs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'fleet-management-secret-key-2026';

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
        load_firm=$5, load_street=$6, load_location=$7, load_date=$8, load_lat=$9, load_lng=$10,
        unload_firm=$11, unload_street=$12, unload_location=$13, unload_date=$14, unload_lat=$15, unload_lng=$16,
        eta=$17, observations=$18, pause_date=$19, pause_time=$20,
        weekend_duration=$21, weekend_day=$22, weekend_time=$23, weekend_week=$24, weekend_history=$25,
        drivers=$26, phone=$27, trailer=$28, fuel_card=$29, fuel_card_expiry=$30,
        amazon_account=$31, vignettes=$32, next_trip=$33,
        file_name=$34, file_data=$35, file_type=$36, vehicle_type=$37,
        driver_1=$38, driver_2=$39
      WHERE id=$40
    `, [
      t.number, t.status, t.client, t.order_number,
      t.load_firm ?? null, t.load_street ?? null, t.load_location, t.load_date, t.load_lat, t.load_lng,
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
      'SELECT id, username, role, permissions FROM users WHERE organization_id = $1',
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
    const { username, password, role, permissions } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const perms = JSON.stringify(permissions || {});
    await pool.query(
      'INSERT INTO users (username, password, role, permissions, organization_id) VALUES ($1,$2,$3,$4,$5)',
      [username, hash, role, perms, req.user.organization_id]
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
    const { password, role, permissions } = req.body;
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        'UPDATE users SET password=$1, role=$2, permissions=$3 WHERE id=$4',
        [hash, role, JSON.stringify(permissions || {}), req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET role=$1, permissions=$2 WHERE id=$3',
        [role, JSON.stringify(permissions || {}), req.params.id]
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

// ── SPA fallback (React Router) ─────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ── START ───────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Server pornit la http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Eroare inițializare DB:', err);
    process.exit(1);
  });
