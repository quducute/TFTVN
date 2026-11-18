import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import { shared } from "./eslint.shared.mjs";

export default defineConfig(js.configs.recommended, tseslint.configs.recommended, shared);
