import { etlRuns } from "@tftvn/db";
import type { NodeDb } from "@tftvn/db/node";
import { eq } from "drizzle-orm";

export async function trackEtlRun<T extends Record<string, unknown>>(
  db: NodeDb,
  job: string,
  run: () => Promise<T>,
): Promise<T> {
  const [started] = await db.insert(etlRuns).values({ job }).returning({ id: etlRuns.id });
  try {
    const summary = await run();
    await db
      .update(etlRuns)
      .set({ status: "succeeded", finishedAt: new Date().toISOString(), summary })
      .where(eq(etlRuns.id, started!.id));
    return summary;
  } catch (error) {
    await db
      .update(etlRuns)
      .set({
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(etlRuns.id, started!.id));
    throw error;
  }
}
