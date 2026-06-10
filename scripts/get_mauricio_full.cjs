const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OHx0M9ybkGoI@ep-misty-dew-ac6fww4f.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  max: 5
});
pool.query("SELECT * FROM corretores WHERE name ILIKE '%mauricio%'")
  .then(r => {
    console.log(JSON.stringify(r.rows[0], null, 2));
    pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
