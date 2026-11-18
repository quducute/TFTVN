import type { ParsedSet } from "@tftvn/core";
import { gameEntities, gameSets, gamedataSnapshots, patches, siteSettings } from "@tftvn/db";
import type { NodeDb } from "@tftvn/db/node";
import { and, eq, ne, or } from "drizzle-orm";

const INSERT_BATCH_SIZE = 200;

export interface StoreInput {
  parsed: ParsedSet;
  patch: string;
  sourceHash: string;
  makeCurrent: boolean;
}

export interface StoreResult {
  snapshotId: number;
  createdSnapshot: boolean;
}

export async function readCurrentSetOverride(db: NodeDb): Promise<number | null> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, "current_set_override"))
    .limit(1);
  return typeof row?.value === "number" ? row.value : null;
}

export async function storeParsedSet(db: NodeDb, input: StoreInput): Promise<StoreResult> {
  const { parsed, patch, sourceHash, makeCurrent } = input;

  return db.transaction(async (tx) => {
    await tx
      .insert(gameSets)
      .values({ id: parsed.number, name: parsed.name, mutator: parsed.mutator })
      .onConflictDoUpdate({
        target: gameSets.id,
        set: { name: parsed.name, mutator: parsed.mutator },
      });

    const [existing] = await tx
      .select({ id: gamedataSnapshots.id })
      .from(gamedataSnapshots)
      .where(
        and(
          eq(gamedataSnapshots.setId, parsed.number),
          eq(gamedataSnapshots.sourceHash, sourceHash),
        ),
      )
      .limit(1);

    let snapshotId = existing?.id;
    const createdSnapshot = snapshotId == null;
    if (snapshotId == null) {
      const [inserted] = await tx
        .insert(gamedataSnapshots)
        .values({ setId: parsed.number, sourceHash })
        .returning({ id: gamedataSnapshots.id });
      snapshotId = inserted!.id;

      const rows = parsed.entities.map((entity) => ({
        snapshotId: snapshotId!,
        kind: entity.kind,
        apiName: entity.apiName,
        i18n: entity.i18n,
        data: entity.data,
        cost: entity.cost,
        traits: entity.traits,
        roleApiName: entity.roleApiName,
        plannerCode: entity.plannerCode,
      }));
      for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
        await tx.insert(gameEntities).values(rows.slice(start, start + INSERT_BATCH_SIZE));
      }
    }

    await tx
      .insert(patches)
      .values({ setId: parsed.number, id: patch, snapshotId, releasedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [patches.setId, patches.id], set: { snapshotId } });

    if (makeCurrent) {
      await tx.update(gameSets).set({ isCurrent: false }).where(ne(gameSets.id, parsed.number));
      await tx.update(gameSets).set({ isCurrent: true }).where(eq(gameSets.id, parsed.number));
      await tx
        .update(patches)
        .set({ isCurrent: false })
        .where(or(ne(patches.setId, parsed.number), ne(patches.id, patch)));
      await tx
        .update(patches)
        .set({ isCurrent: true })
        .where(and(eq(patches.setId, parsed.number), eq(patches.id, patch)));
    }

    return { snapshotId, createdSnapshot };
  });
}

export async function setSnapshotArchive(db: NodeDb, snapshotId: number, archiveUrl: string) {
  await db
    .update(gamedataSnapshots)
    .set({ archiveUrl })
    .where(eq(gamedataSnapshots.id, snapshotId));
}
