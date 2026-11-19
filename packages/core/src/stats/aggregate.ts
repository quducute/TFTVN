export type StatKind = "champion" | "trait" | "item";

export interface StatParticipant {
  placement: number;
  units: { character_id: string; itemNames: string[] }[];
  traits: { name: string; tier_current: number }[];
}

export interface StatIncrement {
  kind: StatKind;
  apiName: string;
  variant: string;
  games: number;
  placementSum: number;
  top1Count: number;
  top4Count: number;
}

const keyOf = (kind: StatKind, apiName: string, variant: string) => `${kind}|${apiName}|${variant}`;

export function participantStats(participant: StatParticipant): StatIncrement[] {
  const rows = new Map<string, StatIncrement>();
  const { placement } = participant;
  const add = (kind: StatKind, apiName: string, variant = "") => {
    const key = keyOf(kind, apiName, variant);
    if (!rows.has(key)) {
      rows.set(key, {
        kind,
        apiName,
        variant,
        games: 1,
        placementSum: placement,
        top1Count: placement === 1 ? 1 : 0,
        top4Count: placement <= 4 ? 1 : 0,
      });
    }
  };

  for (const unit of participant.units) {
    add("champion", unit.character_id);
    for (const item of unit.itemNames) {
      add("item", item);
      add("item", item, unit.character_id);
    }
  }
  for (const trait of participant.traits) {
    if (trait.tier_current > 0) {
      add("trait", trait.name);
      add("trait", trait.name, String(trait.tier_current));
    }
  }
  return [...rows.values()];
}

export function matchStats(participants: readonly StatParticipant[]): StatIncrement[] {
  const merged = new Map<string, StatIncrement>();
  for (const row of participants.flatMap(participantStats)) {
    const key = keyOf(row.kind, row.apiName, row.variant);
    const existing = merged.get(key);
    if (existing) {
      existing.games += row.games;
      existing.placementSum += row.placementSum;
      existing.top1Count += row.top1Count;
      existing.top4Count += row.top4Count;
    } else {
      merged.set(key, { ...row });
    }
  }
  return [...merged.values()];
}

export interface StatView {
  games: number;
  pickRate: number;
  averagePlacement: number;
  top4Rate: number;
  top1Rate: number;
}

export function toStatView(
  row: Pick<StatIncrement, "games" | "placementSum" | "top1Count" | "top4Count">,
  participantCount: number,
): StatView {
  const games = row.games;
  return {
    games,
    pickRate: participantCount > 0 ? games / participantCount : 0,
    averagePlacement: games > 0 ? row.placementSum / games : 0,
    top4Rate: games > 0 ? row.top4Count / games : 0,
    top1Rate: games > 0 ? row.top1Count / games : 0,
  };
}

export function patchForMatch(
  patches: readonly { id: string; releasedAt: string | Date | null }[],
  playedAt: Date,
): string | null {
  const dated = patches
    .map((patch) => ({
      id: patch.id,
      time: patch.releasedAt ? new Date(patch.releasedAt).getTime() : 0,
    }))
    .sort((left, right) => left.time - right.time);
  if (dated.length === 0) {
    return null;
  }
  const played = playedAt.getTime();
  return [...dated].reverse().find((patch) => patch.time <= played)?.id ?? dated[0]!.id;
}
