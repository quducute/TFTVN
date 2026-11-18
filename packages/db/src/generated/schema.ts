import { bytea, citext } from "../column-types";
import {
  pgTable,
  uniqueIndex,
  unique,
  integer,
  text,
  boolean,
  timestamp,
  foreignKey,
  bigint,
  index,
  check,
  uuid,
  jsonb,
  primaryKey,
  smallint,
  char,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const articleStatus = pgEnum("article_status", ["queued", "approved", "rejected"]);
export const etlStatus = pgEnum("etl_status", ["running", "succeeded", "failed"]);
export const gameEntityKind = pgEnum("game_entity_kind", [
  "champion",
  "trait",
  "item",
  "augment",
  "role",
]);
export const metaTier = pgEnum("meta_tier", ["S", "A", "B", "C", "X"]);
export const rankTier = pgEnum("rank_tier", ["challenger", "grandmaster", "master"]);
export const reactionKind = pgEnum("reaction_kind", ["heart", "like", "dislike"]);
export const userRole = pgEnum("user_role", ["user", "admin"]);
export const userTokenKind = pgEnum("user_token_kind", [
  "refresh",
  "password_reset",
  "email_verify",
]);

export const gameSets = pgTable(
  "game_sets",
  {
    id: integer().primaryKey().notNull(),
    name: text().notNull(),
    mutator: text().notNull(),
    isCurrent: boolean("is_current").default(false).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("game_sets_is_current_key")
      .using("btree", table.isCurrent.asc().nullsLast().op("bool_ops"))
      .where(sql`is_current`),
    unique("game_sets_mutator_key").on(table.mutator),
  ],
);

export const gamedataSnapshots = pgTable(
  "gamedata_snapshots",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "gamedata_snapshots_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    setId: integer("set_id").notNull(),
    sourceHash: text("source_hash").notNull(),
    archiveUrl: text("archive_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.setId],
      foreignColumns: [gameSets.id],
      name: "gamedata_snapshots_set_id_fkey",
    }),
    unique("gamedata_snapshots_set_id_source_hash_key").on(table.sourceHash, table.setId),
  ],
);

export const users = pgTable(
  "users",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "users_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    username: citext("username").notNull(),
    email: citext("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "string" }),
    passwordHash: text("password_hash").notNull(),
    role: userRole().default("user").notNull(),
    riotPlatform: text("riot_platform").default("vn2").notNull(),
    riotGameName: text("riot_game_name"),
    riotTagLine: text("riot_tag_line"),
    riotPuuid: text("riot_puuid"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("users_username_key").on(table.username),
    unique("users_email_key").on(table.email),
  ],
);

export const userTokens = pgTable(
  "user_tokens",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "user_tokens_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    kind: userTokenKind().notNull(),
    tokenHash: bytea("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_tokens_expires_at_idx").using(
      "btree",
      table.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("user_tokens_user_id_kind_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("enum_ops"),
      table.kind.asc().nullsLast().op("enum_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_tokens_user_id_fkey",
    }).onDelete("cascade"),
    unique("user_tokens_token_hash_key").on(table.tokenHash),
  ],
);

export const comps = pgTable(
  "comps",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "comps_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    publicId: uuid("public_id").notNull(),
    ownerId: bigint("owner_id", { mode: "number" }).notNull(),
    setId: integer("set_id").notNull(),
    name: text().notNull(),
    description: text(),
    difficulty: text(),
    playstyle: text(),
    avatarChampionApiName: text("avatar_champion_api_name"),
    board: jsonb().notNull(),
    champions: text().array().default([""]).notNull(),
    augments: text().array().default([""]).notNull(),
    metaTier: metaTier("meta_tier"),
    metaPatchId: text("meta_patch_id"),
    metaUpdatedAt: timestamp("meta_updated_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("comps_champions_idx").using("gin", table.champions.asc().nullsLast().op("array_ops")),
    index("comps_owner_id_idx")
      .using("btree", table.ownerId.asc().nullsLast().op("int8_ops"))
      .where(sql`(deleted_at IS NULL)`),
    index("comps_set_id_idx")
      .using("btree", table.setId.asc().nullsLast().op("int4_ops"))
      .where(sql`(deleted_at IS NULL)`),
    index("comps_set_id_meta_tier_idx")
      .using(
        "btree",
        table.setId.asc().nullsLast().op("int4_ops"),
        table.metaTier.asc().nullsLast().op("int4_ops"),
      )
      .where(sql`(meta_tier IS NOT NULL)`),
    foreignKey({
      columns: [table.setId, table.metaPatchId],
      foreignColumns: [patches.id, patches.setId],
      name: "comps_set_id_meta_patch_id_fkey",
    }),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "comps_owner_id_fkey",
    }),
    foreignKey({
      columns: [table.setId],
      foreignColumns: [gameSets.id],
      name: "comps_set_id_fkey",
    }),
    unique("comps_public_id_key").on(table.publicId),
    check(
      "comps_board_check",
      sql`(jsonb_typeof(board) = 'array'::text) AND (jsonb_array_length(board) <= 10)`,
    ),
    check(
      "comps_meta_fields_check",
      sql`(meta_tier IS NOT NULL) OR ((meta_patch_id IS NULL) AND (meta_updated_at IS NULL))`,
    ),
    check("comps_meta_not_deleted_check", sql`(meta_tier IS NULL) OR (deleted_at IS NULL)`),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "articles_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    publicId: uuid("public_id").notNull(),
    authorId: bigint("author_id", { mode: "number" }).notNull(),
    setId: integer("set_id"),
    title: text().notNull(),
    category: text().notNull(),
    tags: text().array().default([""]).notNull(),
    body: text().notNull(),
    status: articleStatus().default("queued").notNull(),
    reviewedBy: bigint("reviewed_by", { mode: "number" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("articles_author_id_idx").using("btree", table.authorId.asc().nullsLast().op("int8_ops")),
    index("articles_status_created_at_idx")
      .using(
        "btree",
        table.status.asc().nullsLast().op("timestamptz_ops"),
        table.createdAt.desc().nullsFirst().op("timestamptz_ops"),
      )
      .where(sql`(deleted_at IS NULL)`),
    index("articles_tags_idx").using("gin", table.tags.asc().nullsLast().op("array_ops")),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
      name: "articles_author_id_fkey",
    }),
    foreignKey({
      columns: [table.setId],
      foreignColumns: [gameSets.id],
      name: "articles_set_id_fkey",
    }),
    foreignKey({
      columns: [table.reviewedBy],
      foreignColumns: [users.id],
      name: "articles_reviewed_by_fkey",
    }),
    unique("articles_public_id_key").on(table.publicId),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: text().primaryKey().notNull(),
    setId: integer("set_id").notNull(),
    patchId: text("patch_id").notNull(),
    queueId: integer("queue_id").notNull(),
    sourceRankTier: rankTier("source_rank_tier").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true, mode: "string" }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("matches_played_at_idx").using(
      "btree",
      table.playedAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("matches_set_id_patch_id_source_rank_tier_idx").using(
      "btree",
      table.setId.asc().nullsLast().op("text_ops"),
      table.patchId.asc().nullsLast().op("text_ops"),
      table.sourceRankTier.asc().nullsLast().op("int4_ops"),
    ),
  ],
);

export const siteSettings = pgTable("site_settings", {
  key: text().primaryKey().notNull(),
  value: jsonb().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const etlRuns = pgTable(
  "etl_runs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({
      name: "etl_runs_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    job: text().notNull(),
    status: etlStatus().default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
    summary: jsonb(),
    error: text(),
  },
  (table) => [
    index("etl_runs_job_started_at_idx").using(
      "btree",
      table.job.asc().nullsLast().op("text_ops"),
      table.startedAt.desc().nullsFirst().op("text_ops"),
    ),
  ],
);

export const riotCache = pgTable(
  "riot_cache",
  {
    key: text().primaryKey().notNull(),
    value: jsonb().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("riot_cache_expires_at_idx").using(
      "btree",
      table.expiresAt.asc().nullsLast().op("timestamptz_ops"),
    ),
  ],
);

export const articleComps = pgTable(
  "article_comps",
  {
    articleId: bigint("article_id", { mode: "number" }).notNull(),
    compId: bigint("comp_id", { mode: "number" }).notNull(),
  },
  (table) => [
    index("article_comps_comp_id_idx").using(
      "btree",
      table.compId.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.articleId],
      foreignColumns: [articles.id],
      name: "article_comps_article_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.compId],
      foreignColumns: [comps.id],
      name: "article_comps_comp_id_fkey",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.compId, table.articleId], name: "article_comps_pkey" }),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: bigint("user_id", { mode: "number" }).notNull(),
    compId: bigint("comp_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("bookmarks_comp_id_idx").using("btree", table.compId.asc().nullsLast().op("int8_ops")),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "bookmarks_user_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.compId],
      foreignColumns: [comps.id],
      name: "bookmarks_comp_id_fkey",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.userId, table.compId], name: "bookmarks_pkey" }),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text().notNull(),
    windowStart: timestamp("window_start", { withTimezone: true, mode: "string" }).notNull(),
    hits: integer().default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.windowStart, table.bucket], name: "rate_limits_pkey" })],
);

export const articleReactions = pgTable(
  "article_reactions",
  {
    articleId: bigint("article_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    kind: reactionKind().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("article_reactions_user_id_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.articleId],
      foreignColumns: [articles.id],
      name: "article_reactions_article_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "article_reactions_user_id_fkey",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.userId, table.articleId], name: "article_reactions_pkey" }),
  ],
);

export const patches = pgTable(
  "patches",
  {
    id: text().notNull(),
    setId: integer("set_id").notNull(),
    snapshotId: bigint("snapshot_id", { mode: "number" }).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true, mode: "string" }),
    isCurrent: boolean("is_current").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("patches_is_current_key")
      .using("btree", table.isCurrent.asc().nullsLast().op("bool_ops"))
      .where(sql`is_current`),
    foreignKey({
      columns: [table.setId],
      foreignColumns: [gameSets.id],
      name: "patches_set_id_fkey",
    }),
    foreignKey({
      columns: [table.snapshotId],
      foreignColumns: [gamedataSnapshots.id],
      name: "patches_snapshot_id_fkey",
    }),
    primaryKey({ columns: [table.setId, table.id], name: "patches_pkey" }),
  ],
);

export const roleItems = pgTable(
  "role_items",
  {
    setId: integer("set_id").notNull(),
    roleApiName: text("role_api_name").notNull(),
    items: text().array().default([""]).notNull(),
    updatedBy: bigint("updated_by", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.setId],
      foreignColumns: [gameSets.id],
      name: "role_items_set_id_fkey",
    }),
    foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [users.id],
      name: "role_items_updated_by_fkey",
    }),
    primaryKey({ columns: [table.setId, table.roleApiName], name: "role_items_pkey" }),
  ],
);

export const statTotals = pgTable(
  "stat_totals",
  {
    setId: integer("set_id").notNull(),
    patchId: text("patch_id").notNull(),
    rankTier: rankTier("rank_tier").notNull(),
    matchCount: integer("match_count").default(0).notNull(),
    participantCount: integer("participant_count").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.setId, table.rankTier, table.patchId], name: "stat_totals_pkey" }),
  ],
);

export const championRoles = pgTable(
  "champion_roles",
  {
    setId: integer("set_id").notNull(),
    championApiName: text("champion_api_name").notNull(),
    roleApiName: text("role_api_name").notNull(),
    updatedBy: bigint("updated_by", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("champion_roles_set_id_role_api_name_idx").using(
      "btree",
      table.setId.asc().nullsLast().op("int4_ops"),
      table.roleApiName.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.setId],
      foreignColumns: [gameSets.id],
      name: "champion_roles_set_id_fkey",
    }),
    foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [users.id],
      name: "champion_roles_updated_by_fkey",
    }),
    primaryKey({ columns: [table.setId, table.championApiName], name: "champion_roles_pkey" }),
  ],
);

export const matchParticipants = pgTable(
  "match_participants",
  {
    matchId: text("match_id").notNull(),
    puuid: text().notNull(),
    placement: smallint().notNull(),
    playerLevel: smallint("player_level"),
    units: jsonb().notNull(),
    traits: jsonb().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.matchId],
      foreignColumns: [matches.id],
      name: "match_participants_match_id_fkey",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.puuid, table.matchId], name: "match_participants_pkey" }),
    check("match_participants_placement_check", sql`(placement >= 1) AND (placement <= 8)`),
  ],
);

export const gameEntities = pgTable(
  "game_entities",
  {
    snapshotId: bigint("snapshot_id", { mode: "number" }).notNull(),
    kind: gameEntityKind().notNull(),
    apiName: text("api_name").notNull(),
    i18n: jsonb("i18n").notNull(),
    data: jsonb().notNull(),
    cost: smallint(),
    traits: text().array(),
    roleApiName: text("role_api_name"),
    plannerCode: char("planner_code", { length: 3 }),
  },
  (table) => [
    index("game_entities_role_api_name_idx")
      .using(
        "btree",
        table.snapshotId.asc().nullsLast().op("int8_ops"),
        table.roleApiName.asc().nullsLast().op("int8_ops"),
      )
      .where(sql`(role_api_name IS NOT NULL)`),
    uniqueIndex("game_entities_snapshot_id_planner_code_key")
      .using(
        "btree",
        table.snapshotId.asc().nullsLast().op("int8_ops"),
        table.plannerCode.asc().nullsLast().op("bpchar_ops"),
      )
      .where(sql`(planner_code IS NOT NULL)`),
    index("game_entities_traits_idx").using("gin", table.traits.asc().nullsLast().op("array_ops")),
    foreignKey({
      columns: [table.snapshotId],
      foreignColumns: [gamedataSnapshots.id],
      name: "game_entities_snapshot_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.snapshotId, table.kind, table.apiName],
      name: "game_entities_pkey",
    }),
    check(
      "game_entities_champion_fields_check",
      sql`(kind = 'champion'::game_entity_kind) OR ((cost IS NULL) AND (traits IS NULL) AND (role_api_name IS NULL) AND (planner_code IS NULL))`,
    ),
  ],
);

export const entityStats = pgTable(
  "entity_stats",
  {
    setId: integer("set_id").notNull(),
    patchId: text("patch_id").notNull(),
    rankTier: rankTier("rank_tier").notNull(),
    kind: gameEntityKind().notNull(),
    apiName: text("api_name").notNull(),
    variant: text().default("").notNull(),
    games: integer().default(0).notNull(),
    placementSum: integer("placement_sum").default(0).notNull(),
    top1Count: integer("top1_count").default(0).notNull(),
    top4Count: integer("top4_count").default(0).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.variant,
        table.setId,
        table.rankTier,
        table.patchId,
        table.kind,
        table.apiName,
      ],
      name: "entity_stats_pkey",
    }),
  ],
);
