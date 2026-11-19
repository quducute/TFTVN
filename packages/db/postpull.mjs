import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const generatedDir = fileURLToPath(new URL("./src/generated/", import.meta.url));
const customTypes = new Set(["citext", "bytea"]);

for (const entry of await readdir(generatedDir)) {
  if (entry === "meta" || entry.endsWith(".sql")) {
    await rm(join(generatedDir, entry), { recursive: true, force: true });
  }
}

function rewrite(source) {
  const lines = source.split("\n");
  const output = [];
  const used = new Set();
  let pendingType = null;

  for (const line of lines) {
    const todo = line.match(/^\s*\/\/ TODO: failed to parse database type '(\w+)'/);
    if (todo) {
      pendingType = todo[1];
      continue;
    }
    if (/^\s*\/\//.test(line)) {
      continue;
    }
    if (pendingType && line.includes("unknown(")) {
      if (!customTypes.has(pendingType)) {
        throw new Error(`Chua co custom type cho kieu '${pendingType}'`);
      }
      used.add(pendingType);
      output.push(line.replace("unknown(", `${pendingType}(`));
      pendingType = null;
      continue;
    }
    output.push(
      line
        .replaceAll(".default(')", '.default("")')
        .replaceAll('.array().default([""])', ".array().default([])")
        .replace(/\bi18N: jsonb\(\)/, 'i18n: jsonb("i18n")'),
    );
  }

  if (used.size > 0) {
    output.unshift(`import { ${[...used].sort().join(", ")} } from "../column-types";`);
  }
  return output.join("\n");
}

for (const file of ["schema.ts", "relations.ts"]) {
  const path = join(generatedDir, file);
  await writeFile(path, rewrite(await readFile(path, "utf8")));
}

console.log("Da lam sach src/generated");
