import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationsDir = fileURLToPath(new URL("../../migrations/", import.meta.url));
const url = process.env.DATABASE_URL_DIRECT;
if (!url) {
  console.error("Thieu DATABASE_URL_DIRECT trong .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`);

  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  const pending = files.filter((name) => !applied.has(name));

  if (pending.length === 0) {
    console.log("Khong co migration moi.");
  }

  for (const name of pending) {
    const sql = await readFile(join(migrationsDir, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Da chay ${name}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`LOI o ${name}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
