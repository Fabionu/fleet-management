require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

const sqlite = new Database(path.join(__dirname, 'database', 'fleet.db'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Start migrare SQLite → PostgreSQL...\n');

    // ── 1. ORGANIZATIONS ──────────────────────────────────────────────────
    const sqliteOrgs = sqlite.prepare('SELECT * FROM organizations').all();
    const orgIdMap = {}; // sqlite id → postgres id

    for (const org of sqliteOrgs) {
      const existing = await client.query(
        'SELECT id FROM organizations WHERE name = $1', [org.name]
      );
      if (existing.rows.length > 0) {
        orgIdMap[org.id] = existing.rows[0].id;
        console.log(`  ↩ Organizație existentă: '${org.name}' (id=${existing.rows[0].id})`);
      } else {
        const res = await client.query(
          'INSERT INTO organizations (name) VALUES ($1) RETURNING id', [org.name]
        );
        orgIdMap[org.id] = res.rows[0].id;
        console.log(`  ✓ Organizație inserată: '${org.name}' → id=${res.rows[0].id}`);
      }
    }

    // Dacă SQLite nu are organizații, folosim org id=1 din PostgreSQL
    const defaultOrgRes = await client.query('SELECT id FROM organizations LIMIT 1');
    const defaultOrgId = defaultOrgRes.rows[0]?.id || 1;

    console.log('');

    // ── 2. USERS ──────────────────────────────────────────────────────────
    let sqliteUsers = [];
    try { sqliteUsers = sqlite.prepare('SELECT * FROM users').all(); } catch(e) {}

    let usersOk = 0, usersSkip = 0;
    for (const u of sqliteUsers) {
      const existing = await client.query(
        'SELECT id FROM users WHERE username = $1', [u.username]
      );
      if (existing.rows.length > 0) { usersSkip++; continue; }

      const orgId = orgIdMap[u.organization_id] || defaultOrgId;
      await client.query(
        `INSERT INTO users (username, password, role, permissions, organization_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [u.username, u.password, u.role, u.permissions || '{}', orgId]
      );
      usersOk++;
    }
    console.log(`✓ Users: ${usersOk} inserați, ${usersSkip} deja existau`);

    // ── 3. TRUCKS ─────────────────────────────────────────────────────────
    let sqliteTrucks = [];
    try { sqliteTrucks = sqlite.prepare('SELECT * FROM trucks').all(); } catch(e) {}

    let trucksOk = 0, trucksSkip = 0;
    for (const t of sqliteTrucks) {
      const existing = await client.query(
        'SELECT id FROM trucks WHERE number = $1', [t.number]
      );
      if (existing.rows.length > 0) { trucksSkip++; continue; }

      const orgId = orgIdMap[t.organization_id] || defaultOrgId;
      await client.query(
        `INSERT INTO trucks (
          number, status, client, order_number,
          load_location, load_date, load_eta, load_lat, load_lng,
          unload_location, unload_date, unload_lat, unload_lng,
          eta, observations, pause_date, pause_time,
          weekend_duration, weekend_day, weekend_time, weekend_week, weekend_history,
          drivers, phone, trailer,
          fuel_card, fuel_card_expiry,
          amazon_account, vignettes, next_trip,
          file_name, file_data, file_type,
          vehicle_type, organization_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
        )`,
        [
          t.number, t.status || 'liber', t.client, t.order_number,
          t.load_location, t.load_date, t.load_eta, t.load_lat, t.load_lng,
          t.unload_location, t.unload_date, t.unload_lat, t.unload_lng,
          t.eta, t.observations, t.pause_date, t.pause_time,
          t.weekend_duration, t.weekend_day, t.weekend_time, t.weekend_week, t.weekend_history || '[]',
          t.drivers, t.phone, t.trailer,
          t.fuel_card, t.fuel_card_expiry,
          t.amazon_account || 0, t.vignettes || '[]', t.next_trip,
          t.file_name, t.file_data, t.file_type,
          t.vehicle_type, orgId
        ]
      );
      trucksOk++;
    }
    console.log(`✓ Trucks: ${trucksOk} inserați, ${trucksSkip} deja existau`);

    // ── 4. TRIPS ──────────────────────────────────────────────────────────
    let sqliteTrips = [];
    try { sqliteTrips = sqlite.prepare('SELECT * FROM trips').all(); } catch(e) {}

    let tripsOk = 0;
    for (const t of sqliteTrips) {
      const orgId = orgIdMap[t.organization_id] || defaultOrgId;
      await client.query(
        `INSERT INTO trips (
          client, order_number, load_date, unload_date,
          price, km_empty, km_loaded, tolls,
          truck_number, driver, invoiced,
          file_name, file_data, file_type,
          load_location, unload_location, load_coords, unload_coords,
          cmr_file_name, cmr_file_data, cmr_file_type,
          invoice_file_name, invoice_file_data, invoice_file_type,
          created_by, created_at, organization_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24,$25,$26,$27
        )`,
        [
          t.client, t.order_number, t.load_date, t.unload_date,
          t.price, t.km_empty, t.km_loaded, t.tolls,
          t.truck_number, t.driver, t.invoiced || 0,
          t.file_name, t.file_data, t.file_type,
          t.load_location, t.unload_location, t.load_coords, t.unload_coords,
          t.cmr_file_name, t.cmr_file_data, t.cmr_file_type,
          t.invoice_file_name, t.invoice_file_data, t.invoice_file_type,
          t.created_by, t.created_at || new Date().toISOString(), orgId
        ]
      );
      tripsOk++;
    }
    console.log(`✓ Trips: ${tripsOk} inserați`);

    // ── 5. DRIVERS ────────────────────────────────────────────────────────
    let sqliteDrivers = [];
    try { sqliteDrivers = sqlite.prepare('SELECT * FROM drivers').all(); } catch(e) {}

    const driverIdMap = {};
    let driversOk = 0, driversSkip = 0;
    for (const d of sqliteDrivers) {
      const existing = await client.query(
        'SELECT id FROM drivers WHERE name = $1 AND organization_id = $2',
        [d.name, orgIdMap[d.organization_id] || defaultOrgId]
      );
      if (existing.rows.length > 0) {
        driverIdMap[d.id] = existing.rows[0].id;
        driversSkip++;
        continue;
      }
      const orgId = orgIdMap[d.organization_id] || defaultOrgId;
      const res = await client.query(
        'INSERT INTO drivers (name, organization_id) VALUES ($1, $2) RETURNING id',
        [d.name, orgId]
      );
      driverIdMap[d.id] = res.rows[0].id;
      driversOk++;
    }
    console.log(`✓ Drivers: ${driversOk} inserați, ${driversSkip} deja existau`);

    // ── 6. DRIVER DOCUMENTS ───────────────────────────────────────────────
    let sqliteDocs = [];
    try { sqliteDocs = sqlite.prepare('SELECT * FROM driver_documents').all(); } catch(e) {}

    let docsOk = 0;
    for (const doc of sqliteDocs) {
      const newDriverId = driverIdMap[doc.driver_id];
      if (!newDriverId) continue;
      await client.query(
        `INSERT INTO driver_documents (driver_id, doc_type, file_name, file_data, file_type, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newDriverId, doc.doc_type, doc.file_name, doc.file_data, doc.file_type, doc.expiry_date]
      );
      docsOk++;
    }
    console.log(`✓ Driver documents: ${docsOk} inserați`);

    console.log('\n✅ Migrare completă!');
  } catch (err) {
    console.error('\n❌ Eroare la migrare:', err.message);
    console.error(err);
  } finally {
    client.release();
    pool.end();
    sqlite.close();
  }
}

migrate();
