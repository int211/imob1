const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const NEON_URL = 'postgresql://neondb_owner:npg_OHx0M9ybkGoI@ep-misty-dew-ac6fww4f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  const my = await mysql.createConnection({
    host: 'vps.subirei.com.br', port: 3306, user: 'imob',
    password: 'zIOjhz/XRLH@Ec3W', database: 'imob', connectTimeout: 10000
  });

  const pg = new Pool({ connectionString: NEON_URL });
  const pc = await pg.connect();

  console.log('Connected');

  // Drop everything
  await pc.query('DROP TABLE IF EXISTS ratings CASCADE');
  await pc.query('DROP TABLE IF EXISTS notifications CASCADE');
  await pc.query('DROP TABLE IF EXISTS favorites CASCADE');
  await pc.query('DROP TABLE IF EXISTS match_history CASCADE');
  await pc.query('DROP TABLE IF EXISTS matches CASCADE');
  await pc.query('DROP TABLE IF EXISTS demand_neighborhoods CASCADE');
  await pc.query('DROP TABLE IF EXISTS demands CASCADE');
  await pc.query('DROP TABLE IF EXISTS property_features CASCADE');
  await pc.query('DROP TABLE IF EXISTS properties CASCADE');
  await pc.query('DROP TABLE IF EXISTS corretor_specialties CASCADE');
  await pc.query('DROP TABLE IF EXISTS corretores CASCADE');

  await pc.query('DROP TYPE IF EXISTS corretor_status CASCADE');
  await pc.query('DROP TYPE IF EXISTS listing_type CASCADE');
  await pc.query('DROP TYPE IF EXISTS listing_purpose CASCADE');
  await pc.query('DROP TYPE IF EXISTS property_status CASCADE');
  await pc.query('DROP TYPE IF EXISTS urgency_level CASCADE');
  await pc.query('DROP TYPE IF EXISTS match_status CASCADE');
  await pc.query('DROP TYPE IF EXISTS notif_type CASCADE');
  await pc.query('DROP TYPE IF EXISTS favorite_type CASCADE');

  // Use VARCHAR instead of ENUM to handle accented MySQL values
  const VARCHAR = 'VARCHAR';

  await pc.query(`
    CREATE TABLE corretores (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      creci VARCHAR(30) NOT NULL UNIQUE,
      phone VARCHAR(30) NOT NULL,
      whatsapp VARCHAR(30),
      city VARCHAR(100) NOT NULL,
      status ${VARCHAR}(20) NOT NULL DEFAULT 'Pendente',
      photo_url VARCHAR(512),
      rating NUMERIC(3,2) NOT NULL DEFAULT 5.0,
      responding_rate INTEGER NOT NULL DEFAULT 100,
      closed_deals INTEGER NOT NULL DEFAULT 0,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      ident_doc_url VARCHAR(512),
      creci_doc_url VARCHAR(512),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pc.query(`
    CREATE TABLE corretor_specialties (
      corretor_id VARCHAR(50) NOT NULL REFERENCES corretores(id) ON DELETE CASCADE,
      specialty VARCHAR(100) NOT NULL,
      PRIMARY KEY (corretor_id, specialty)
    )`);

  await pc.query(`
    CREATE TABLE properties (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type ${VARCHAR}(20) NOT NULL,
      purpose ${VARCHAR}(20) NOT NULL,
      price NUMERIC(15,2) NOT NULL,
      city VARCHAR(100) NOT NULL,
      neighborhood VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      bedrooms INTEGER NOT NULL DEFAULT 0,
      bathrooms INTEGER NOT NULL DEFAULT 0,
      parking_spots INTEGER NOT NULL DEFAULT 0,
      area NUMERIC(10,2) NOT NULL DEFAULT 0.00,
      commission VARCHAR(255) NOT NULL,
      accepts_partnership BOOLEAN NOT NULL DEFAULT TRUE,
      condo_fee NUMERIC(12,2),
      iptu NUMERIC(12,2),
      virtual_tour VARCHAR(512),
      video_url VARCHAR(512),
      photos TEXT,
      status ${VARCHAR}(10) NOT NULL DEFAULT 'Ativo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by VARCHAR(50) NOT NULL REFERENCES corretores(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pc.query(`
    CREATE TABLE property_features (
      property_id VARCHAR(50) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      feature VARCHAR(100) NOT NULL,
      PRIMARY KEY (property_id, feature)
    )`);

  await pc.query(`
    CREATE TABLE demands (
      id VARCHAR(50) PRIMARY KEY,
      type ${VARCHAR}(20) NOT NULL,
      purpose ${VARCHAR}(20) NOT NULL,
      city VARCHAR(100) NOT NULL,
      max_price NUMERIC(15,2) NOT NULL,
      bedrooms INTEGER NOT NULL DEFAULT 0,
      parking_spots INTEGER NOT NULL DEFAULT 0,
      min_area NUMERIC(10,2) NOT NULL DEFAULT 0.00,
      urgency ${VARCHAR}(10) NOT NULL DEFAULT 'media',
      payment_method VARCHAR(255) NOT NULL,
      notes TEXT,
      ia_raw_text TEXT,
      use_ia BOOLEAN NOT NULL DEFAULT FALSE,
      cover_photo VARCHAR(512),
      status ${VARCHAR}(10) NOT NULL DEFAULT 'Ativo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by VARCHAR(50) NOT NULL REFERENCES corretores(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pc.query(`
    CREATE TABLE demand_neighborhoods (
      demand_id VARCHAR(50) NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
      neighborhood VARCHAR(100) NOT NULL,
      PRIMARY KEY (demand_id, neighborhood)
    )`);

  await pc.query(`
    CREATE TABLE matches (
      id VARCHAR(50) PRIMARY KEY,
      property_id VARCHAR(50) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      demand_id VARCHAR(50) NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      insights TEXT,
      status ${VARCHAR}(20) NOT NULL DEFAULT 'Novo',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (property_id, demand_id)
    )`);

  await pc.query(`
    CREATE TABLE match_history (
      id BIGSERIAL PRIMARY KEY,
      match_id VARCHAR(50) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      status ${VARCHAR}(20) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by VARCHAR(150) NOT NULL,
      notes TEXT
    )`);

  await pc.query(`
    CREATE TABLE favorites (
      id VARCHAR(50) PRIMARY KEY,
      broker_id VARCHAR(50) NOT NULL REFERENCES corretores(id) ON DELETE CASCADE,
      favorite_type ${VARCHAR}(10) NOT NULL,
      target_id VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pc.query(`
    CREATE TABLE notifications (
      id VARCHAR(50) PRIMARY KEY,
      broker_id VARCHAR(50) NOT NULL REFERENCES corretores(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ${VARCHAR}(20) NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  await pc.query(`
    CREATE TABLE ratings (
      id VARCHAR(50) PRIMARY KEY,
      broker_id VARCHAR(50) NOT NULL REFERENCES corretores(id) ON DELETE CASCADE,
      rating_by VARCHAR(150) NOT NULL,
      score INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  // Indexes
  const indexes = [
    'CREATE INDEX idx_corretor_status ON corretores(status)',
    'CREATE INDEX idx_corretor_email ON corretores(email)',
    'CREATE INDEX idx_corretor_creci ON corretores(creci)',
    'CREATE INDEX idx_prop_search ON properties(city, neighborhood, status)',
    'CREATE INDEX idx_prop_price ON properties(price)',
    'CREATE INDEX idx_prop_created_by ON properties(created_by)',
    'CREATE INDEX idx_prop_type_purpose ON properties(type, purpose)',
    'CREATE INDEX idx_demands_city_status ON demands(city, status)',
    'CREATE INDEX idx_demands_max_price ON demands(max_price)',
    'CREATE INDEX idx_demands_created_by ON demands(created_by)',
    'CREATE INDEX idx_matches_score ON matches(score)',
    'CREATE INDEX idx_matches_status ON matches(status)',
    'CREATE INDEX idx_favorites_lookup ON favorites(broker_id, favorite_type, target_id)',
    'CREATE INDEX idx_notif_broker_read ON notifications(broker_id, is_read)',
    'CREATE INDEX idx_ratings_broker ON ratings(broker_id)',
    'CREATE INDEX idx_match_history_match ON match_history(match_id)',
    'CREATE INDEX idx_properties_created_at ON properties(created_at)',
    'CREATE INDEX idx_demands_created_at ON demands(created_at)',
    'CREATE INDEX idx_matches_created_at ON matches(created_at)',
  ];
  for (const idx of indexes) {
    await pc.query(idx).catch(() => {});
  }

  console.log('Schema created');

  // Migrate data
  const tables = ['corretores', 'corretor_specialties', 'properties', 'property_features',
    'demands', 'demand_neighborhoods', 'matches', 'match_history', 'favorites', 'notifications', 'ratings'];

  for (const table of tables) {
    const [rows] = await my.query('SELECT * FROM ' + table);
    if (rows.length === 0) { console.log('  ' + table + ': 0 rows'); continue; }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map((_, i) => '$' + (i + 1)).join(', ');
    const insertSQL = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let inserted = 0;
    for (const row of rows) {
      const values = columns.map(col => {
        const v = row[col];
        if (v === null || v === undefined) return null;
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v;
        if (v instanceof Date) return v.toISOString();
        return String(v);
      });
      try {
        await pc.query(insertSQL, values);
        inserted++;
      } catch (e) {
        console.error('  ERROR ' + table + ':', e.message.substring(0, 120));
      }
    }
    console.log('  ' + table + ': ' + inserted + '/' + rows.length);
  }

  console.log('\nMigration complete!');
  await my.end();
  pc.release();
  await pg.end();
}

migrate().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
