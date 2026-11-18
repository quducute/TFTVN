import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as relations from "./generated/relations";
import * as tables from "./generated/schema";

export * from "./generated/schema";

const schema = { ...tables, ...relations };

function createDb(url: string) {
  return drizzle({ client: neon(url), schema, casing: "snake_case" });
}

let instance: ReturnType<typeof createDb> | undefined;

export function getDb() {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    instance = createDb(url);
  }
  return instance;
}
