import type {
  CompDifficulty,
  CompErrorCode,
  CompFieldErrors,
  CompPlaystyle,
  CompUnit,
  MetaTier,
} from "@tftvn/core";

export interface CompContent {
  setId: number;
  name: string;
  description: string | null;
  difficulty: CompDifficulty | null;
  playstyle: CompPlaystyle | null;
  avatarChampionApiName: string | null;
  board: CompUnit[];
  champions: string[];
  augments: string[];
}

export interface CompRecord extends CompContent {
  id: number;
  publicId: string;
  ownerId: number;
  ownerUsername: string;
  metaTier: MetaTier | null;
  metaPatchId: string | null;
  metaUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicComp = Omit<CompRecord, "id">;

export interface CompListFilter {
  setId?: number;
  ownerId?: number;
  bookmarkedBy?: number;
  metaOnly?: boolean;
  championApiName?: string;
  limit: number;
  offset: number;
}

export interface CompListPage {
  rows: CompRecord[];
  total: number;
}

export interface CompCatalog {
  setId: number;
  currentPatchId: string;
  champions: ReadonlySet<string>;
  items: ReadonlySet<string>;
  augments: ReadonlySet<string>;
}

export interface CompRepository {
  insert(input: CompContent & { publicId: string; ownerId: number }): Promise<CompRecord>;
  update(id: number, input: CompContent): Promise<CompRecord>;
  findByPublicId(publicId: string): Promise<CompRecord | null>;
  softDelete(id: number, now: Date): Promise<void>;
  setMeta(
    id: number,
    meta: { tier: MetaTier; patchId: string; now: Date } | null,
  ): Promise<CompRecord>;
  list(filter: CompListFilter): Promise<CompListPage>;
  setBookmark(userId: number, compId: number, bookmarked: boolean): Promise<void>;
  isBookmarked(userId: number, compId: number): Promise<boolean>;
  bookmarkCount(compId: number): Promise<number>;
}

export type CompResult<Value> =
  | { ok: true; value: Value }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 409;
      code: CompErrorCode;
      fields?: CompFieldErrors;
    };

export interface CompActor {
  id: number;
  role: "user" | "admin";
}
