import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const rootEnvFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@tftvn/db", "@tftvn/core", "@tftvn/riot"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "raw.communitydragon.org" }],
  },
};

export default createNextIntlPlugin()(nextConfig);
