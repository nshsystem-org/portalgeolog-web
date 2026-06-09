const { Client } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync('/home/geolog/Documents/geolog/web/supabase/migrations/20260608000000_notification_chips_metadata.sql', 'utf8');

const client = new Client({
  host: 'db.hzpgfapvjwqtjclriisz.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'AdminPGeolog@2026',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  family: 4,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected');
    await client.query(sql);
    console.log('Migration applied successfully');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
