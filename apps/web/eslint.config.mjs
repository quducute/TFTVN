import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { defineConfig } from "eslint/config";
import { shared } from "../../eslint.shared.mjs";

export default defineConfig(
  nextVitals,
  nextTypescript,
  { settings: { next: { rootDir: import.meta.dirname } } },
  shared,
);
