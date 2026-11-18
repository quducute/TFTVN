import { relations } from "drizzle-orm/relations";
import {
  gameSets,
  gamedataSnapshots,
  patches,
  users,
  userTokens,
  comps,
  articles,
  articleComps,
  bookmarks,
  articleReactions,
  roleItems,
  matches,
  matchParticipants,
  gameEntities,
} from "./schema";

export const gamedataSnapshotsRelations = relations(gamedataSnapshots, ({ one, many }) => ({
  gameSet: one(gameSets, {
    fields: [gamedataSnapshots.setId],
    references: [gameSets.id],
  }),
  patches: many(patches),
  gameEntities: many(gameEntities),
}));

export const gameSetsRelations = relations(gameSets, ({ many }) => ({
  gamedataSnapshots: many(gamedataSnapshots),
  patches: many(patches),
  comps: many(comps),
  articles: many(articles),
  roleItems: many(roleItems),
}));

export const patchesRelations = relations(patches, ({ one, many }) => ({
  gameSet: one(gameSets, {
    fields: [patches.setId],
    references: [gameSets.id],
  }),
  gamedataSnapshot: one(gamedataSnapshots, {
    fields: [patches.snapshotId],
    references: [gamedataSnapshots.id],
  }),
  comps: many(comps),
}));

export const userTokensRelations = relations(userTokens, ({ one }) => ({
  user: one(users, {
    fields: [userTokens.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userTokens: many(userTokens),
  comps: many(comps),
  articles_authorId: many(articles, {
    relationName: "articles_authorId_users_id",
  }),
  articles_reviewedBy: many(articles, {
    relationName: "articles_reviewedBy_users_id",
  }),
  bookmarks: many(bookmarks),
  articleReactions: many(articleReactions),
  roleItems: many(roleItems),
}));

export const compsRelations = relations(comps, ({ one, many }) => ({
  user: one(users, {
    fields: [comps.ownerId],
    references: [users.id],
  }),
  gameSet: one(gameSets, {
    fields: [comps.setId],
    references: [gameSets.id],
  }),
  patch: one(patches, {
    fields: [comps.metaPatchId],
    references: [patches.id],
  }),
  articleComps: many(articleComps),
  bookmarks: many(bookmarks),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  user_authorId: one(users, {
    fields: [articles.authorId],
    references: [users.id],
    relationName: "articles_authorId_users_id",
  }),
  gameSet: one(gameSets, {
    fields: [articles.setId],
    references: [gameSets.id],
  }),
  user_reviewedBy: one(users, {
    fields: [articles.reviewedBy],
    references: [users.id],
    relationName: "articles_reviewedBy_users_id",
  }),
  articleComps: many(articleComps),
  articleReactions: many(articleReactions),
}));

export const articleCompsRelations = relations(articleComps, ({ one }) => ({
  article: one(articles, {
    fields: [articleComps.articleId],
    references: [articles.id],
  }),
  comp: one(comps, {
    fields: [articleComps.compId],
    references: [comps.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  comp: one(comps, {
    fields: [bookmarks.compId],
    references: [comps.id],
  }),
}));

export const articleReactionsRelations = relations(articleReactions, ({ one }) => ({
  article: one(articles, {
    fields: [articleReactions.articleId],
    references: [articles.id],
  }),
  user: one(users, {
    fields: [articleReactions.userId],
    references: [users.id],
  }),
}));

export const roleItemsRelations = relations(roleItems, ({ one }) => ({
  gameSet: one(gameSets, {
    fields: [roleItems.setId],
    references: [gameSets.id],
  }),
  user: one(users, {
    fields: [roleItems.updatedBy],
    references: [users.id],
  }),
}));

export const matchParticipantsRelations = relations(matchParticipants, ({ one }) => ({
  match: one(matches, {
    fields: [matchParticipants.matchId],
    references: [matches.id],
  }),
}));

export const matchesRelations = relations(matches, ({ many }) => ({
  matchParticipants: many(matchParticipants),
}));

export const gameEntitiesRelations = relations(gameEntities, ({ one }) => ({
  gamedataSnapshot: one(gamedataSnapshots, {
    fields: [gameEntities.snapshotId],
    references: [gamedataSnapshots.id],
  }),
}));
