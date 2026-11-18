import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as relations from "./generated/relations";
import * as tables from "./generated/schema";

const schema = { ...tables, ...relations };

export function createNodeDb(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, close: () => pool.end() };
}

export type NodeDb = ReturnType<typeof createNodeDb>["db"];
