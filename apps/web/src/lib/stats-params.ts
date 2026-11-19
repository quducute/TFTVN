export const RANK_TIERS = ["challenger", "grandmaster", "master"] as const;
export const STAT_SECTIONS = ["champions", "traits", "items"] as const;

export type RankTier = (typeof RANK_TIERS)[number];
export type StatSection = (typeof STAT_SECTIONS)[number];
