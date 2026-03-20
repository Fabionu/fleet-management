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
    markInvoiced: true,
    viewReports: true,
    chatCreateGroup: true,
    chatManageMembers: true,
    chatSendTripOrder: true,
    chatDeleteMessage: true,
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
    markInvoiced: false,
    viewReports: false,
    chatCreateGroup: true,
    chatManageMembers: true,
    chatSendTripOrder: true,
    chatDeleteMessage: true,
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
    markInvoiced: true,
    viewReports: false,
    chatCreateGroup: false,
    chatManageMembers: false,
    chatSendTripOrder: false,
    chatDeleteMessage: true,
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

    // Trailers
    await client.query(`
      CREATE TABLE IF NOT EXISTS trailers (
        id SERIAL PRIMARY KEY,
        number TEXT NOT NULL,
        type TEXT,
        status TEXT DEFAULT 'libera',
        current_truck TEXT,
        itp_expiry TEXT,
        rca_expiry TEXT,
        observations TEXT,
        organization_id INTEGER REFERENCES organizations(id)
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

    // Migration: add amazon_account column to drivers
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS amazon_account INTEGER DEFAULT 0`);

    // Migration: add load_firm, load_street, unload_firm, unload_street to trips
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS load_firm TEXT`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS load_street TEXT`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS unload_firm TEXT`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS unload_street TEXT`);

    // Migration: add load_firm, load_street, unload_firm, unload_street to trucks
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS load_firm TEXT`);
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS load_street TEXT`);
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS unload_firm TEXT`);
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS unload_street TEXT`);

    // Migration: add vat column to organizations
    await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vat TEXT`);

    // Migration: add email column to users
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);

    // Migration: add first_name and last_name to users
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT`);

    // Migration: add trailers table (for existing DBs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS trailers (
        id SERIAL PRIMARY KEY,
        number TEXT NOT NULL,
        type TEXT,
        status TEXT DEFAULT 'libera',
        current_truck TEXT,
        itp_expiry TEXT,
        rca_expiry TEXT,
        observations TEXT,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Chat tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id),
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_read (
        username TEXT NOT NULL,
        organization_id INTEGER NOT NULL,
        last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (username, organization_id)
      )
    `);

    // Migration: add receiver_username for private messages
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS receiver_username TEXT`);

    // Per-conversation read tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_conv_read (
        username TEXT NOT NULL,
        peer_username TEXT NOT NULL,
        organization_id INTEGER NOT NULL,
        last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (username, peer_username, organization_id)
      )
    `);

    // Chat Groups tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        organization_id INTEGER REFERENCES organizations(id),
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_group_members (
        group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        organization_id INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, username)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_group_messages (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
        organization_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_group_read (
        username TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        organization_id INTEGER NOT NULL,
        last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (username, group_id)
      )
    `);

    // Migrate: add message_type column to chat_group_messages
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'`);

    // Migration: add load_eta column to trucks if not exists
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS load_eta TEXT`);

    // Migration: add extra_stops column to trips (multiple load/unload stops)
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS extra_stops TEXT DEFAULT '[]'`);

    // Migration: add extra_stops column to trucks (multiple load/unload stops)
    await client.query(`ALTER TABLE trucks ADD COLUMN IF NOT EXISTS extra_stops TEXT DEFAULT '[]'`);

    // Truck Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS truck_documents (
        id SERIAL PRIMARY KEY,
        truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
        doc_type TEXT NOT NULL,
        file_name TEXT,
        file_data TEXT,
        file_type TEXT,
        expiry_date TEXT,
        organization_id INTEGER REFERENCES organizations(id)
      )
    `);

    // Migration: reply-to columns for DM messages
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_username TEXT`);

    // Migration: reply-to columns for group messages
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER`);
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS reply_to_text TEXT`);
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS reply_to_username TEXT`);

    // Migration: pin columns for DM messages
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS pinned_by TEXT`);

    // Migration: pin columns for group messages
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS pinned_by TEXT`);

    // Migration: soft-delete & edit for DM messages
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP`);

    // Migration: soft-delete & edit for group messages
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP`);

    // Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6b7280',
        permissions TEXT DEFAULT '{}',
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        is_system BOOLEAN DEFAULT FALSE,
        UNIQUE(name, organization_id)
      )
    `);

    // Seed default roles for each organization (if not already present)
    const orgs = await client.query(`SELECT id FROM organizations`);
    const defaultRoles = [
      { name: 'Administrator',  color: '#ff7a3d', perms: defaultPermissions.admin,       is_system: true },
      { name: 'Dispecer',       color: '#3b82f6', perms: defaultPermissions.dispatcher,   is_system: true },
      { name: 'Contabil',       color: '#8b5cf6', perms: defaultPermissions.contabil,     is_system: true },
    ];
    for (const org of orgs.rows) {
      for (const r of defaultRoles) {
        await client.query(
          `INSERT INTO roles (name, color, permissions, organization_id, is_system)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (name, organization_id) DO NOTHING`,
          [r.name, r.color, JSON.stringify(r.perms), org.id, r.is_system]
        );
      }
    }

    // Migration: add role_id column to users (after roles table exists)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL`);

    // Migration: message_type for DM messages
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'`);

    // Migration: trip_order_status for DM and group messages
    await client.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS trip_order_status TEXT`);
    await client.query(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS trip_order_status TEXT`);

    console.log('✓ Baza de date PostgreSQL inițializată cu succes');
  } finally {
    client.release();
  }
}

module.exports = { pool, defaultPermissions, initDb };
