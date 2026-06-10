const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_OHx0M9ybkGoI@ep-misty-dew-ac6fww4f.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  max: 5
});
pool.query("SELECT id, name, email, status, is_admin FROM brokers ORDER BY name")
  .then(r => {
    console.log("All brokers in Neon (" + r.rows.length + "):");
    r.rows.forEach(b => console.log(b.id.substring(0,12) + '... | ' + b.name + ' | ' + b.email + ' | ' + b.status + ' | admin=' + b.is_admin));
    pool.end();
  })
  .catch(e => { console.error(e.message); pool.end(); });
