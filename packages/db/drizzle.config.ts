import { defineConfig } from "drizzle-kit";

process.loadEnvFile("../../.env.local");

export default defineConfig({
  dialect: "postgresql",
  out: "./src/generated",
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? "" },
  casing: "snake_case",
  introspect: { casing: "camel" },
  tablesFilter: ["!schema_migrations"],
});
