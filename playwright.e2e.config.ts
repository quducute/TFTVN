import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const port = 3100;

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  testDir: "apps/web/e2e",
  testMatch: "**/*.spec.ts",
  globalTeardown: "./apps/web/e2e/teardown.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" } }],
  webServer: {
    command: `pnpm --filter @tftvn/web build && pnpm --filter @tftvn/web start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
});
