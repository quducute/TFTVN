import { GameIcon } from "@/components/game-icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { type IndexedSetData, boardTraits } from "@/lib/comp-set";
import { compPath } from "@/lib/comp-paths";
import { COST_BORDER } from "@/lib/format";
import type { PublicComp } from "@/server/comps/types";
import { TierBadge } from "./tier-badge";
import { TraitList } from "./trait-list";

interface CompCardProps {
  comp: PublicComp;
  index: IndexedSetData;
  byLabel: string;
}

export function CompCard({ comp, index, byLabel }: CompCardProps) {
  const champions = [...new Set(comp.board.map((unit) => unit.championApiName))]
    .map((apiName) => ({ apiName, info: index.champions.get(apiName) }))
    .sort((left, right) => (left.info?.cost ?? 0) - (right.info?.cost ?? 0));
  const avatar = index.champions.get(comp.avatarChampionApiName ?? champions.at(-1)?.apiName ?? "");

  return (
    <article className="h-full rounded-xl border border-line/10 bg-surface/5 transition hover:border-primary">
      <Link href={compPath.detail(comp.publicId)} className="flex h-full flex-col gap-3 p-4">
        <header className="flex items-center gap-3">
          <GameIcon
            path={avatar?.icon}
            alt=""
            size={48}
            className={cn("border-2", COST_BORDER[avatar?.cost ?? 0] ?? "border-line/20")}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{comp.name}</h3>
            <p className="truncate text-xs text-muted">{byLabel}</p>
          </div>
          {comp.metaTier ? <TierBadge tier={comp.metaTier} /> : null}
        </header>
        <TraitList
          traits={boardTraits(comp.board, index)}
          index={index}
          limit={4}
          showInactive={false}
        />
        <ul className="mt-auto flex flex-wrap gap-1">
          {champions.map(({ apiName, info }) => (
            <li key={apiName}>
              <GameIcon
                path={info?.icon}
                alt={info?.name ?? apiName}
                size={30}
                className={cn("border", COST_BORDER[info?.cost ?? 0] ?? "border-line/20")}
              />
            </li>
          ))}
        </ul>
      </Link>
    </article>
  );
}
