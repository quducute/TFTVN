import { GameIcon } from "@/components/game-icon";
import { cn } from "@/lib/cn";
import type { GameEntityInfo } from "@/server/game-lookup";

const STYLE_CLASS: Record<number, string> = {
  1: "bg-trait-bronze",
  2: "bg-trait-silver",
  3: "bg-trait-gold",
  4: "bg-trait-gold",
  5: "bg-trait-prismatic",
};

interface TraitBadgeProps {
  trait: GameEntityInfo;
  style: number;
  units: number;
}

export function TraitBadge({ trait, style, units }: TraitBadgeProps) {
  return (
    <span
      title={`${trait.name} (${units})`}
      className="inline-flex items-center gap-1 rounded-full border border-line/10 bg-surface/5 py-0.5 pr-2 pl-0.5 text-xs"
    >
      <span className={cn("rounded-full p-0.5", STYLE_CLASS[style] ?? "bg-surface/20")}>
        <GameIcon
          path={trait.icon}
          alt={trait.name}
          size={18}
          className={cn("rounded-full", STYLE_CLASS[style] ? "invert" : null)}
        />
      </span>
      <span>{trait.name}</span>
      <span className="text-muted">{units}</span>
    </span>
  );
}
