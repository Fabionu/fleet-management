require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RAILWAY_ENVIRONMENT ? { rejectUnauthorized: false } : false
});

// Permisiuni default per rol
const defaultPermissions = {
  admin: {
    editVehicleInfo: true,
    toggleAmazon: true,
    addTrip: true,
    editTrip: true,
    deleteTrip: true,
    clearTruckData: true,
    deleteTruckRow: true,
    addNextTrip: true,
    markInvoiced: true
  },
  dispatcher: {
    editVehicleInfo: false,
    toggleAmazon: false,
    addTrip: true,
    editTrip: true,
    deleteTrip: false,
    clearTruckData: true,
    deleteTruckRow: true,
    addNextTrip: true,
    markInvoiced: false
  },
  contabil: {
    editVehicleInfo: false,
    toggleAmazon: false,
    addTrip: false,
    editTrip: true,
    deleteTrip: false,
    clearTruckData: false,
    deleteTruckRow: false,
    addNextTrip: false,
    markInvoiced: true
  }
};

async function initDb() {
  const client = await pool.connect();
  try {
    // Organizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'dispatcher',
        permissions TEXT DEFAULT '{}',
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Trucks
    await client.query(`
      CREATE TABLE IF NOT EXISTS trucks (
        id SERIAL PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'liber',
        client TEXT,
        order_number TEXT,
        load_location TEXT,
        load_date TEXT,
        load_eta TEXT,
        load_lat TEXT,
        load_lng TEXT,
        unload_location TEXT,
        unload_date TEXT,
        unload_lat TEXT,
        unload_lng TEXT,
        eta TEXT,
        observations TEXT,
        pause_date TEXT,
        pause_time TEXT,
        weekend_duration TEXT,
        weekend_day TEXT,
        weekend_time TEXT,
        drivers TEXT,
        phone TEXT,
        trailer TEXT,
        fuel_card TEXT,
        fuel_card_expiry TEXT,
        amazon_account INTEGER DEFAULT 0,
        vignettes TEXT DEFAULT '[]',
        next_trip TEXT,
        file_name TEXT,
        file_data TEXT,
        file_type TEXT,
        weekend_week TEXT,
        weekend_history TEXT DEFAULT '[]',
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Trips
    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        client TEXT,
        order_number TEXT,
        load_date TEXT,
        unload_date TEXT,
        price REAL,
        km_empty REAL,
        km_loaded REAL,
        tolls REAL,
        truck_number TEXT,
        driver TEXT,
        invoiced INTEGER DEFAULT 0,
        file_name TEXT,
        file_data TEXT,
        file_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        load_location TEXT,
        unload_location TEXT,
        load_coords TEXT,
        unload_coords TEXT,
        cmr_file_name TEXT,
        cmr_file_data TEXT,
        cmr_file_type TEXT,
        invoice_file_name TEXT,
        invoice_file_data TEXT,
        invoice_file_type TEXT,
        created_by TEXT,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Drivers
    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Driver Documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_documents (
        id SERIAL PRIMARY KEY,
        driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        doc_type TEXT NOT NULL,
        file_name TEXT,
        file_data TEXT,
        file_type TEXT,
        expiry_date TEXT
      )
    `);

    // Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Organizație default
    const orgResult = await client.query(
      `SELECT id FROM organizations WHERE name = $1`,
      ['Default']
    );
    let orgId;
    if (orgResult.rows.length === 0) {
      const newOrg = await client.query(
        `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
        ['Default']
      );
      orgId = newOrg.rows[0].id;
      console.log(`✓ Organizație 'Default' creată (id=${orgId})`);
    } else {
      orgId = orgResult.rows[0].id;
    }

    // Useri default
    const usersToCreate = [
      { username: 'admin',  password: 'admin',      role: 'admin' },
      { username: 'Fabio',  password: 'Tofan2308!', role: 'dispatcher' },
      { username: 'Marcel', password: '123',         role: 'dispatcher' }
    ];

    for (const u of usersToCreate) {
      const existing = await client.query(
        `SELECT id FROM users WHERE username = $1`,
        [u.username]
      );
      if (existing.rows.length === 0) {
        const hash = bcrypt.hashSync(u.password, 10);
        const perms = JSON.stringify(defaultPermissions[u.role]);
        await client.query(
          `INSERT INTO users (username, password, role, permissions, organization_id) VALUES ($1, $2, $3, $4, $5)`,
          [u.username, hash, u.role, perms, orgId]
        );
        console.log(`✓ User '${u.username}' creat cu rol '${u.role}'`);
      }
    }

    // Migration: add vehicle_type column to trucks if not exists
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS vehicle_type TEXT`);

    // Migration: add hire_date and is_active columns to drivers if not exists
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS hire_date TEXT`);
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`);

    // Migration: add first_name and last_name columns to drivers
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS first_name TEXT`);
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_name TEXT`);

    // Migration: add driver_1 and driver_2 columns to trucks
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS driver_1 TEXT`);
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS driver_2 TEXT`);

    // Migration: add assigned_truck column to drivers
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS assigned_truck TEXT`);

    console.log('✓ Baza de date PostgreSQL inițializată cu succes');
  } finally {
    client.release();
  }
}

module.exports = { pool, defaultPermissions, initDb };
