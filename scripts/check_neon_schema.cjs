const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OHx0M9ybkGoI@ep-misty-dew-ac6fww4f.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  max: 5
});
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'corretores' ORDER BY ordinal_position")
  .then(r => {
    console.log("Schema for corretores:");
    r.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));
    pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
