import type { CompRecord, CompRepository } from "./types";

export function createMemoryCompRepository(usernameOf: (userId: number) => string) {
  const comps: (CompRecord & { deletedAt: Date | null })[] = [];
  const bookmarks = new Set<string>();
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 19, 0, 0, clock++)).toISOString();
  const strip = (stored: CompRecord & { deletedAt: Date | null }): CompRecord => {
    const comp: Partial<typeof stored> = structuredClone(stored);
    delete comp.deletedAt;
    return comp as CompRecord;
  };
  const byId = (id: number) => {
    const comp = comps.find((candidate) => candidate.id === id);
    if (!comp) {
      throw new Error(`comp ${id} not found`);
    }
    return comp;
  };

  const repository: CompRepository = {
    async insert(input) {
      const time = stamp();
      const comp = {
        ...structuredClone(input),
        id: comps.length + 1,
        ownerUsername: usernameOf(input.ownerId),
        metaTier: null,
        metaPatchId: null,
        metaUpdatedAt: null,
        createdAt: time,
        updatedAt: time,
        deletedAt: null,
      };
      comps.push(comp);
      return strip(comp);
    },
    async update(id, input) {
      const comp = byId(id);
      Object.assign(comp, structuredClone(input), { updatedAt: stamp() });
      return strip(comp);
    },
    async findByPublicId(publicId) {
      const comp = comps.find(
        (candidate) => candidate.publicId === publicId && !candidate.deletedAt,
      );
      return comp ? strip(comp) : null;
    },
    async softDelete(id, now) {
      byId(id).deletedAt = now;
    },
    async setMeta(id, meta) {
      const comp = byId(id);
      comp.metaTier = meta?.tier ?? null;
      comp.metaPatchId = meta?.patchId ?? null;
      comp.metaUpdatedAt = meta ? meta.now.toISOString() : null;
      return strip(comp);
    },
    async list(filter) {
      const matching = comps
        .filter(
          (comp) =>
            !comp.deletedAt &&
            (filter.setId == null || comp.setId === filter.setId) &&
            (filter.ownerId == null || comp.ownerId === filter.ownerId) &&
            (filter.bookmarkedBy == null || bookmarks.has(`${filter.bookmarkedBy}:${comp.id}`)) &&
            (!filter.metaOnly || comp.metaTier != null) &&
            (filter.championApiName == null || comp.champions.includes(filter.championApiName)),
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return {
        total: matching.length,
        rows: matching.slice(filter.offset, filter.offset + filter.limit).map(strip),
      };
    },
    async setBookmark(userId, compId, bookmarked) {
      if (bookmarked) {
        bookmarks.add(`${userId}:${compId}`);
      } else {
        bookmarks.delete(`${userId}:${compId}`);
      }
    },
    async isBookmarked(userId, compId) {
      return bookmarks.has(`${userId}:${compId}`);
    },
    async bookmarkCount(compId) {
      return [...bookmarks].filter((key) => key.endsWith(`:${compId}`)).length;
    },
  };

  return { repository, comps };
}
