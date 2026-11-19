import type { ItemData } from "@tftvn/core";
import { GameIcon } from "@/components/game-icon";
import { GameText } from "@/components/game-text";
import type { Locale } from "@/i18n/routing";
import { type LibraryEntity, localized } from "@/server/library";

interface ItemCardProps {
  item: LibraryEntity<ItemData>;
  locale: Locale;
  components?: Map<string, LibraryEntity<ItemData>>;
  recipeLabel?: string;
  compact?: boolean;
}

export function ItemCard({ item, locale, components, recipeLabel, compact }: ItemCardProps) {
  const text = localized(item, locale);
  const recipe = item.data.composition
    .map((apiName) => components?.get(apiName))
    .filter((component): component is LibraryEntity<ItemData> => component != null);

  return (
    <li
      id={item.apiName}
      className="scroll-mt-24 rounded-xl border border-line/10 bg-surface/5 p-4 target:border-primary"
    >
      <div className="flex items-center gap-3">
        <GameIcon path={item.data.icon} alt={text.name} size={40} />
        <h3 className="font-semibold">{text.name}</h3>
      </div>
      {recipe.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span>{recipeLabel}:</span>
          {recipe.map((component, index) => (
            <GameIcon
              key={`${component.apiName}-${index}`}
              path={component.data.icon}
              alt={localized(component, locale).name}
              size={24}
            />
          ))}
        </div>
      ) : null}
      {text.description && !compact ? (
        <GameText text={text.description} className="mt-2 text-sm" />
      ) : null}
    </li>
  );
}
