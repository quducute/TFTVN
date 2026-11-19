import {
  type CompErrorCode,
  type CompFieldErrors,
  type CompInput,
  compInputSchema,
  metaTierSchema,
  toCompFieldErrors,
} from "@tftvn/core";
import type {
  CompActor,
  CompCatalog,
  CompContent,
  CompListFilter,
  CompListPage,
  CompRecord,
  CompRepository,
  CompResult,
  PublicComp,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CompServiceDependencies {
  repository: CompRepository;
  catalog: (setId: number) => Promise<CompCatalog | null>;
  newPublicId: () => string;
  now: () => Date;
}

const fail = (
  status: 400 | 401 | 403 | 404 | 409,
  code: CompErrorCode,
  fields?: CompFieldErrors,
): CompResult<never> => ({ ok: false, status, code, fields });

export function toPublicComp(record: CompRecord): PublicComp {
  const comp: Partial<CompRecord> = { ...record };
  delete comp.id;
  return comp as PublicComp;
}

function unknownEntity(input: CompInput, catalog: CompCatalog): Record<string, CompErrorCode> {
  const fields: Record<string, CompErrorCode> = {};
  if (input.board.some((unit) => !catalog.champions.has(unit.championApiName))) {
    fields.board = "unknownChampion";
  } else if (input.board.some((unit) => unit.items.some((item) => !catalog.items.has(item)))) {
    fields.board = "unknownItem";
  }
  if (input.augments.some((augment) => !catalog.augments.has(augment))) {
    fields.augments = "unknownAugment";
  }
  return fields;
}

export function createCompService({
  repository,
  catalog,
  newPublicId,
  now,
}: CompServiceDependencies) {
  const validate = async (input: unknown): Promise<CompResult<CompContent>> => {
    const parsed = compInputSchema.safeParse(input);
    if (!parsed.success) {
      const fields = toCompFieldErrors(parsed.error);
      return fail(400, Object.values(fields)[0] ?? "unknown", fields);
    }
    const value = parsed.data;
    const setCatalog = await catalog(value.setId);
    if (!setCatalog) {
      return fail(400, "setInvalid", { setId: "setInvalid" });
    }
    const fields = unknownEntity(value, setCatalog);
    const first = Object.values(fields)[0];
    if (first) {
      return fail(400, first, fields);
    }
    return {
      ok: true,
      value: {
        ...value,
        champions: [...new Set(value.board.map((unit) => unit.championApiName))],
      },
    };
  };

  const findEditable = async (
    actor: CompActor,
    publicId: string,
  ): Promise<CompResult<CompRecord>> => {
    const comp = UUID.test(publicId) ? await repository.findByPublicId(publicId) : null;
    if (!comp) {
      return fail(404, "compNotFound");
    }
    if (comp.ownerId !== actor.id && actor.role !== "admin") {
      return fail(403, "forbidden");
    }
    return { ok: true, value: comp };
  };

  const find = async (publicId: string): Promise<CompRecord | null> =>
    UUID.test(publicId) ? repository.findByPublicId(publicId) : null;

  return {
    find,

    list(filter: CompListFilter): Promise<CompListPage> {
      return repository.list(filter);
    },

    async create(actor: CompActor, input: unknown): Promise<CompResult<CompRecord>> {
      const content = await validate(input);
      if (!content.ok) {
        return content;
      }
      const comp = await repository.insert({
        ...content.value,
        publicId: newPublicId(),
        ownerId: actor.id,
      });
      return { ok: true, value: comp };
    },

    async update(
      actor: CompActor,
      publicId: string,
      input: unknown,
    ): Promise<CompResult<CompRecord>> {
      const existing = await findEditable(actor, publicId);
      if (!existing.ok) {
        return existing;
      }
      const content = await validate(input);
      if (!content.ok) {
        return content;
      }
      if (existing.value.metaTier && content.value.setId !== existing.value.setId) {
        return fail(409, "compIsMeta", { setId: "compIsMeta" });
      }
      return { ok: true, value: await repository.update(existing.value.id, content.value) };
    },

    async remove(actor: CompActor, publicId: string): Promise<CompResult<CompRecord>> {
      const existing = await findEditable(actor, publicId);
      if (!existing.ok) {
        return existing;
      }
      if (existing.value.metaTier) {
        return fail(409, "compIsMeta");
      }
      await repository.softDelete(existing.value.id, now());
      return existing;
    },

    async setMeta(
      actor: CompActor,
      publicId: string,
      input: unknown,
    ): Promise<CompResult<CompRecord>> {
      if (actor.role !== "admin") {
        return fail(403, "forbidden");
      }
      const parsed = metaTierSchema.safeParse(input);
      if (!parsed.success) {
        return fail(400, "tierInvalid", { tier: "tierInvalid" });
      }
      const comp = await find(publicId);
      if (!comp) {
        return fail(404, "compNotFound");
      }
      const { tier } = parsed.data;
      if (!tier) {
        return { ok: true, value: await repository.setMeta(comp.id, null) };
      }
      const setCatalog = await catalog(comp.setId);
      if (!setCatalog) {
        return fail(400, "setInvalid");
      }
      return {
        ok: true,
        value: await repository.setMeta(comp.id, {
          tier,
          patchId: setCatalog.currentPatchId,
          now: now(),
        }),
      };
    },

    async bookmarkState(
      actor: CompActor | null,
      publicId: string,
    ): Promise<CompResult<{ bookmarked: boolean; count: number }>> {
      const comp = await find(publicId);
      if (!comp) {
        return fail(404, "compNotFound");
      }
      const [bookmarked, count] = await Promise.all([
        actor ? repository.isBookmarked(actor.id, comp.id) : Promise.resolve(false),
        repository.bookmarkCount(comp.id),
      ]);
      return { ok: true, value: { bookmarked, count } };
    },

    async setBookmark(
      actor: CompActor,
      publicId: string,
      bookmarked: boolean,
    ): Promise<CompResult<{ bookmarked: boolean; count: number }>> {
      const comp = await find(publicId);
      if (!comp) {
        return fail(404, "compNotFound");
      }
      await repository.setBookmark(actor.id, comp.id, bookmarked);
      return {
        ok: true,
        value: { bookmarked, count: await repository.bookmarkCount(comp.id) },
      };
    },
  };
}

export type CompService = ReturnType<typeof createCompService>;
