import { RiotApiError } from "@tftvn/riot";
import { headers } from "next/headers";
import type { RiotErrorKind } from "@/components/riot/riot-error";
import { clientKeyFromHeaders, hitRateLimit } from "../rate-limit";

export const PLAYER_LOOKUPS_PER_MINUTE = 30;

export type Guarded<Value> = { ok: true; value: Value } | { ok: false; kind: RiotErrorKind };

export function riotErrorKind(error: unknown): RiotErrorKind {
  if (error instanceof RiotApiError) {
    return error.kind;
  }
  console.error("Riot lookup failed", error);
  return "unavailable";
}

export async function guardedLookup<Value>(
  bucket: string,
  load: () => Promise<Value>,
): Promise<Guarded<Value>> {
  try {
    const hits = await hitRateLimit(`${bucket}:${clientKeyFromHeaders(await headers())}`, 60);
    if (hits > PLAYER_LOOKUPS_PER_MINUTE) {
      return { ok: false, kind: "tooManyLookups" };
    }
    return { ok: true, value: await load() };
  } catch (error) {
    return { ok: false, kind: riotErrorKind(error) };
  }
}
