import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

const migrationsDir = new URL("../../migrations/", import.meta.url);
const latest = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .at(-1);
const file = process.argv[2] ?? new URL(latest, migrationsDir);
const url = process.env.DATABASE_URL_DIRECT;
if (!url) {
  console.error("Thieu DATABASE_URL_DIRECT trong .env.local");
  process.exit(1);
}

const sql = await readFile(file, "utf8");
const client = new pg.Client({ connectionString: url });

function lineOf(pos) {
  return sql.slice(0, pos).split("\n").length;
}

try {
  await client.connect();
  const {
    rows: [v],
  } = await client.query("SHOW server_version");
  console.log(`Ket noi OK -- Postgres ${v.server_version}`);

  await client.query("BEGIN");
  await client.query(sql);

  const { rows } = await client.query(`
    SELECT c.relname AS name,
           CASE c.relpersistence WHEN 'u' THEN 'UNLOGGED' ELSE '' END AS note
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`);
  console.log(`\n${file} chay thanh cong, tao ${rows.length} bang:`);
  for (const r of rows) console.log(`  - ${r.name} ${r.note}`);
} catch (err) {
  console.error(`\nLOI: ${err.message}`);
  if (err.position) console.error(`  tai dong ${lineOf(Number(err.position))} trong ${file}`);
  if (err.detail) console.error(`  chi tiet: ${err.detail}`);
  process.exitCode = 1;
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
  console.log("\nDa ROLLBACK -- database khong bi thay doi.");
}
