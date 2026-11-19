import { defineConfig } from "@playwright/test";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  projects: [
    { name: "core", testDir: "packages/core/src", testMatch: "**/*.test.ts" },
    { name: "riot", testDir: "packages/riot/src", testMatch: "**/*.test.ts" },
    { name: "web", testDir: "apps/web/src", testMatch: "**/*.test.ts" },
  ],
});
