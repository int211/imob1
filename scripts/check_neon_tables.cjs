const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OHx0M9ybkGoI@ep-misty-dew-ac6fww4f.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  max: 5
});
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
  .then(r => {
    console.log("Tables in Neon:", r.rows.map(t => t.table_name));
    pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
