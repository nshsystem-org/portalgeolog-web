const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("Uso: node scripts/apply-migration.js <arquivo.sql>");
  process.exit(1);
}

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("SUPABASE_DB_PASSWORD não definido no ambiente.");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(sqlPath), "utf8");

const client = new Client({
  host: process.env.SUPABASE_DB_HOST || "aws-1-us-east-2.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER || "postgres.hzpgfapvjwqtjclriisz",
  password,
  database: process.env.SUPABASE_DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected");
    await client.query(sql);
    console.log("Migration applied successfully");
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
