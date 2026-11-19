import { z } from "zod";

export const MAX_ROLE_ITEMS = 8;

export type AdminErrorCode =
  | "setInvalid"
  | "championInvalid"
  | "roleInvalid"
  | "itemInvalid"
  | "tooManyItems"
  | "forbidden"
  | "unauthorized"
  | "forbiddenOrigin"
  | "unknown";

export interface AdminCatalog {
  champions: ReadonlySet<string>;
  roles: ReadonlySet<string>;
  items: ReadonlySet<string>;
}

export interface AdminRepository {
  setChampionRole(
    setId: number,
    championApiName: string,
    roleApiName: string | null,
    userId: number,
  ): Promise<void>;
  setRoleItems(setId: number, roleApiName: string, items: string[], userId: number): Promise<void>;
}

export type AdminResult<Value> =
  { ok: true; value: Value } | { ok: false; status: 400 | 403 | 404; code: AdminErrorCode };

const roleBody = z.object({ role: z.string().min(1).nullable() });
const itemsBody = z.object({ items: z.array(z.string().min(1)) });

const fail = (status: 400 | 403 | 404, code: AdminErrorCode): AdminResult<never> => ({
  ok: false,
  status,
  code,
});

export function createAdminService({
  repository,
  catalog,
}: {
  repository: AdminRepository;
  catalog: (setId: number) => Promise<AdminCatalog | null>;
}) {
  const loadCatalog = async (setParam: string) =>
    /^\d+$/.test(setParam) ? catalog(Number(setParam)) : null;

  return {
    async setChampionRole(
      userId: number,
      setParam: string,
      championApiName: string,
      input: unknown,
    ): Promise<AdminResult<{ setId: number; role: string | null }>> {
      const setCatalog = await loadCatalog(setParam);
      if (!setCatalog) {
        return fail(404, "setInvalid");
      }
      if (!setCatalog.champions.has(championApiName)) {
        return fail(404, "championInvalid");
      }
      const parsed = roleBody.safeParse(input);
      if (!parsed.success || (parsed.data.role && !setCatalog.roles.has(parsed.data.role))) {
        return fail(400, "roleInvalid");
      }
      const setId = Number(setParam);
      await repository.setChampionRole(setId, championApiName, parsed.data.role, userId);
      return { ok: true, value: { setId, role: parsed.data.role } };
    },

    async setRoleItems(
      userId: number,
      setParam: string,
      roleApiName: string,
      input: unknown,
    ): Promise<AdminResult<{ setId: number; items: string[] }>> {
      const setCatalog = await loadCatalog(setParam);
      if (!setCatalog) {
        return fail(404, "setInvalid");
      }
      if (!setCatalog.roles.has(roleApiName)) {
        return fail(404, "roleInvalid");
      }
      const parsed = itemsBody.safeParse(input);
      if (!parsed.success) {
        return fail(400, "itemInvalid");
      }
      const items = [...new Set(parsed.data.items)];
      if (items.length > MAX_ROLE_ITEMS) {
        return fail(400, "tooManyItems");
      }
      if (items.some((item) => !setCatalog.items.has(item))) {
        return fail(400, "itemInvalid");
      }
      const setId = Number(setParam);
      await repository.setRoleItems(setId, roleApiName, items, userId);
      return { ok: true, value: { setId, items } };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
