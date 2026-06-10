import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_OHx0M9ybkGoI@ep-misty-dew-ac6fww4f-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
});
try {
  const { rows } = await pool.query("SELECT id, title, photos FROM properties WHERE title LIKE '%Veraneio%'");
  console.log(JSON.stringify(rows, null, 2));
} catch(e) { console.error(e); }
await pool.end();
