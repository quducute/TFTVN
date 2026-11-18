import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import {
  HashResolver,
  type ParsedSet,
  collectVocabulary,
  detectCurrentSet,
  hashOverrides,
  parseSet,
} from "@tftvn/core";
import { createNodeDb } from "@tftvn/db/node";
import axios from "axios";
import { archiveToGithubRelease } from "./archive";
import { downloadCDragon } from "./cdragon-client";
import { optionalEnv, requireEnv } from "./env";
import { trackEtlRun } from "./etl-run";
import { readCurrentSetOverride, setSnapshotArchive, storeParsedSet } from "./store";

const { values: args } = parseArgs({
  options: {
    set: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
  },
});

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function countBy<T>(entries: readonly T[], key: (entry: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[key(entry)] = (counts[key(entry)] ?? 0) + 1;
  }
  return counts;
}

function summarize(parsed: ParsedSet) {
  const missing = parsed.report.missingPlaceholders.filter((entry) => entry.kind !== "champion");
  return {
    set: parsed.number,
    mutator: parsed.mutator,
    counts: countBy(parsed.entities, (entity) => entity.kind),
    unresolvedHashes: parsed.report.unresolvedHashes,
    entitiesWithMissingPlaceholders: countBy(
      parsed.report.missingPlaceholders,
      (entry) => entry.kind,
    ),
    ...(args.verbose ? { missingPlaceholders: missing } : {}),
  };
}

async function revalidate(tag: string): Promise<boolean> {
  const url = optionalEnv("REVALIDATE_URL");
  const secret = optionalEnv("REVALIDATE_SECRET");
  if (!url || !secret) {
    return false;
  }
  await axios.post(
    url,
    { tag },
    { headers: { Authorization: `Bearer ${secret}` }, timeout: 30_000 },
  );
  return true;
}

async function main() {
  const download = await downloadCDragon();
  const resolver = new HashResolver(
    collectVocabulary([download.sources.vi, download.sources.en]),
    hashOverrides,
  );
  const requestedSet = args.set ? Number(args.set) : null;
  const parse = (setNumber: number) =>
    parseSet({
      sources: download.sources,
      teamPlanner: download.teamPlanner,
      setNumber,
      resolver,
    });

  if (args["dry-run"]) {
    const parsed = parse(requestedSet ?? detectCurrentSet(download.sources.vi).number);
    console.log(
      JSON.stringify(
        { version: download.version, patch: download.patch, ...summarize(parsed) },
        null,
        2,
      ),
    );
    return;
  }

  const { db, close } = createNodeDb(requireEnv("DATABASE_URL_DIRECT"));
  try {
    const summary = await trackEtlRun(db, "sync-gamedata", async () => {
      const current = detectCurrentSet(download.sources.vi, await readCurrentSetOverride(db));
      const setNumber = requestedSet ?? current.number;
      const makeCurrent = setNumber === current.number;
      const parsed = parse(setNumber);
      const stored = await storeParsedSet(db, {
        parsed,
        patch: download.patch,
        sourceHash: sha256(JSON.stringify(parsed.entities)),
        makeCurrent,
      });

      let archiveUrl: string | null = null;
      if (stored.createdSnapshot) {
        archiveUrl = await archiveToGithubRelease({
          patch: download.patch,
          sourceHash: sha256(Object.values(download.rawFiles).join("")),
          rawFiles: download.rawFiles,
        });
        if (archiveUrl) {
          await setSnapshotArchive(db, stored.snapshotId, archiveUrl);
        }
      }

      return {
        version: download.version,
        patch: download.patch,
        current: makeCurrent,
        snapshotId: stored.snapshotId,
        createdSnapshot: stored.createdSnapshot,
        archiveUrl,
        revalidated: stored.createdSnapshot ? await revalidate("gamedata") : false,
        ...summarize(parsed),
      };
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await close();
  }
}

await main();
