const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OHx0M9ybkGoI@ep-misty-dew-ac6fww4f.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  max: 5
});
pool.query("UPDATE corretores SET city = $1 WHERE id = $2", ['Salvador', 'broker-1781118286367'])
  .then(r => {
    console.log('Updated ' + r.rowCount + ' row(s)');
    pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
