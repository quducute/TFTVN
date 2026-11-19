import { cacheLife, cacheTag } from "next/cache";
import { createDbCompRepository } from "./db-repository";
import { COMPS_TAG, compTag } from "./routes";
import { toPublicComp } from "./service";
import type { CompListFilter, PublicComp } from "./types";

export const COMP_PAGE_SIZE = 12;
const META_LIMIT = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const repository = createDbCompRepository();

export interface PublicCompPage {
  rows: PublicComp[];
  total: number;
  page: number;
  pages: number;
}

async function listPage(
  filter: Omit<CompListFilter, "limit" | "offset">,
  page: number,
): Promise<PublicCompPage> {
  const current = Math.max(1, Math.trunc(page) || 1);
  const result = await repository.list({
    ...filter,
    limit: COMP_PAGE_SIZE,
    offset: (current - 1) * COMP_PAGE_SIZE,
  });
  return {
    rows: result.rows.map(toPublicComp),
    total: result.total,
    page: current,
    pages: Math.max(1, Math.ceil(result.total / COMP_PAGE_SIZE)),
  };
}

async function cachedComp(publicId: string): Promise<PublicComp | null> {
  "use cache";
  cacheLife("max");
  cacheTag(COMPS_TAG, compTag(publicId));
  const comp = await repository.findByPublicId(publicId);
  return comp ? toPublicComp(comp) : null;
}

export async function getComp(publicId: string): Promise<PublicComp | null> {
  return UUID.test(publicId) ? cachedComp(publicId.toLowerCase()) : null;
}

export async function getMetaComps(setId: number): Promise<PublicComp[]> {
  "use cache";
  cacheLife("max");
  cacheTag(COMPS_TAG);
  const result = await repository.list({ setId, metaOnly: true, limit: META_LIMIT, offset: 0 });
  return result.rows.map(toPublicComp);
}

export async function getLatestComps(
  setId: number,
  page: number,
  championApiName: string | null,
): Promise<PublicCompPage> {
  "use cache";
  cacheLife("max");
  cacheTag(COMPS_TAG);
  return listPage({ setId, championApiName: championApiName ?? undefined }, page);
}

export function getOwnedComps(ownerId: number, page: number): Promise<PublicCompPage> {
  return listPage({ ownerId }, page);
}

export function getBookmarkedComps(userId: number, page: number): Promise<PublicCompPage> {
  return listPage({ bookmarkedBy: userId }, page);
}
