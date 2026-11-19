import { riotIdSchema } from "@tftvn/core";

const segment = (value: string) => encodeURIComponent(value.trim()).replaceAll(".", "%2E");

export const riotPath = {
  players: () => "/players",
  player: (gameName: string, tagLine: string) =>
    `/players/${segment(gameName)}/${segment(tagLine)}`,
  leaderboard: (page = 1) => (page > 1 ? `/leaderboard?page=${page}` : "/leaderboard"),
  stats: (tier: string, section: string) => `/stats/${tier}/${section}`,
};

export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const separator = input.lastIndexOf("#");
  if (separator <= 0) {
    return null;
  }
  const result = riotIdSchema.safeParse({
    gameName: input.slice(0, separator),
    tagLine: input.slice(separator + 1),
  });
  return result.success ? result.data : null;
}

export function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
