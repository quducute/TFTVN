"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { GameIcon } from "@/components/game-icon";
import { cn } from "@/lib/cn";
import { COST_BORDER } from "@/lib/format";

export interface StatsTableVariant {
  key: string;
  label: string;
  icon: string | null;
  games: number;
  averagePlacement: number;
}

export interface StatsTableRow {
  apiName: string;
  name: string;
  icon: string | null;
  cost: number | null;
  games: number;
  pickRate: number;
  averagePlacement: number;
  top4Rate: number;
  top1Rate: number;
  variants: StatsTableVariant[];
}

const SORT_KEYS = ["games", "pickRate", "averagePlacement", "top4Rate", "top1Rate"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const FORMAT: Record<SortKey, (value: number) => string> = {
  games: (value) => String(value),
  pickRate: percent,
  averagePlacement: (value) => value.toFixed(2),
  top4Rate: percent,
  top1Rate: percent,
};

export function StatsTable({ rows }: Readonly<{ rows: StatsTableRow[] }>) {
  const t = useTranslations("stats.columns");
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({
    key: "games",
    ascending: false,
  });

  const sorted = [...rows].sort((left, right) => {
    const difference = left[sort.key] - right[sort.key];
    return sort.ascending ? difference : -difference;
  });

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, ascending: !current.ascending }
        : { key, ascending: key === "averagePlacement" },
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-line/10">
      <table className="w-full text-sm">
        <thead className="bg-surface/5 text-left text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">
              {t("name")}
            </th>
            {SORT_KEYS.map((key) => (
              <th
                key={key}
                scope="col"
                aria-sort={
                  sort.key === key ? (sort.ascending ? "ascending" : "descending") : undefined
                }
                className="px-3 py-2 text-right"
              >
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className={cn("hover:text-primary", sort.key === key ? "text-primary" : null)}
                >
                  {t(key)}
                  {sort.key === key ? (sort.ascending ? " ^" : " v") : null}
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-2">
              {t("variants")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.apiName} className="border-t border-line/10">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                <span className="flex items-center gap-2">
                  <GameIcon
                    path={row.icon}
                    alt=""
                    size={28}
                    className={cn(
                      row.cost ? "border-2" : null,
                      row.cost ? COST_BORDER[row.cost] : null,
                    )}
                  />
                  {row.name}
                </span>
              </th>
              {SORT_KEYS.map((key) => (
                <td key={key} className="px-3 py-2 text-right tabular-nums">
                  {FORMAT[key](row[key])}
                </td>
              ))}
              <td className="px-3 py-2">
                <ul className="flex gap-2">
                  {row.variants.map((variant) => (
                    <li
                      key={variant.key}
                      title={`${variant.label}: ${variant.games} - ${variant.averagePlacement.toFixed(2)}`}
                      className="flex items-center gap-1 text-xs text-muted"
                    >
                      {variant.icon ? (
                        <GameIcon path={variant.icon} alt={variant.label} size={22} />
                      ) : (
                        <span className="rounded border border-line/20 px-1.5 py-0.5">
                          {variant.label}
                        </span>
                      )}
                      <span className="tabular-nums">{variant.averagePlacement.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
