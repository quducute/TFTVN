import type { TraitCount } from "@tftvn/core";
import { TraitBadge } from "@/components/riot/trait-badge";
import { cn } from "@/lib/cn";
import type { IndexedSetData } from "@/lib/comp-set";

interface TraitListProps {
  traits: readonly TraitCount[];
  index: IndexedSetData;
  limit?: number;
  showInactive?: boolean;
}

export function TraitList({ traits, index, limit, showInactive = true }: TraitListProps) {
  const visible = traits.filter((trait) => showInactive || trait.style > 0).slice(0, limit);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {visible.map((trait) => {
        const info = index.traits.get(trait.apiName);
        return (
          <li key={trait.apiName} className={cn(trait.style === 0 ? "opacity-50" : null)}>
            <TraitBadge
              trait={{ name: info?.name ?? trait.apiName, icon: info?.icon ?? null, cost: null }}
              style={trait.style}
              units={trait.count}
            />
          </li>
        );
      })}
    </ul>
  );
}
