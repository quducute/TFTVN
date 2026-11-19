import { GameIcon } from "@/components/game-icon";
import { cn } from "@/lib/cn";
import { COST_BORDER, COST_TEXT } from "@/lib/format";
import type { GameEntityInfo } from "@/server/game-lookup";

interface UnitIconProps {
  champion: GameEntityInfo;
  star: number;
  items: GameEntityInfo[];
  size?: number;
}

export function UnitIcon({ champion, star, items, size = 44 }: UnitIconProps) {
  const cost = champion.cost ?? 0;
  return (
    <figure className="flex flex-col items-center gap-0.5" style={{ width: size }}>
      <span
        aria-label={`${star}*`}
        className={cn(
          "h-3 text-[10px] leading-3 tracking-tighter",
          COST_TEXT[cost] ?? "text-muted",
        )}
      >
        {"*".repeat(Math.max(0, Math.min(star, 4)))}
      </span>
      <GameIcon
        path={champion.icon}
        alt={champion.name}
        size={size}
        className={cn("border-2", COST_BORDER[cost] ?? "border-line/20")}
      />
      <span className="flex h-3.5 gap-px">
        {items.map((item, index) => (
          <GameIcon
            key={`${item.name}-${index}`}
            path={item.icon}
            alt={item.name}
            size={14}
            className="rounded-sm"
          />
        ))}
      </span>
      <figcaption className="sr-only">{champion.name}</figcaption>
    </figure>
  );
}
