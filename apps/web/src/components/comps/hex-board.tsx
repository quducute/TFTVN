import { BOARD_COLUMNS, BOARD_HEXES, type CompUnit } from "@tftvn/core";
import type { CSSProperties, DragEvent } from "react";
import { GameIcon } from "@/components/game-icon";
import { cn } from "@/lib/cn";
import type { IndexedSetData } from "@/lib/comp-set";

const COST_BACKGROUND: Record<number, string> = {
  1: "bg-cost1",
  2: "bg-cost2",
  3: "bg-cost3",
  4: "bg-cost4",
  5: "bg-cost5",
};

const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";
const HEX_RATIO = 1.1547;

export interface HexBoardHandlers {
  selectedHex?: number | null;
  onHexClick?: (hex: number) => void;
  onHexDrop?: (hex: number, event: DragEvent<HTMLElement>) => void;
  onUnitDragStart?: (hex: number, event: DragEvent<HTMLElement>) => void;
}

interface HexBoardProps extends HexBoardHandlers {
  units: readonly CompUnit[];
  index: IndexedSetData;
  label: string;
  hexSize?: number;
}

export function HexBoard({
  units,
  index,
  label,
  hexSize = 60,
  selectedHex = null,
  onHexClick,
  onHexDrop,
  onUnitDragStart,
}: HexBoardProps) {
  const byHex = new Map(units.map((unit) => [unit.hex, unit]));
  const interactive = onHexClick != null;
  const rows = BOARD_HEXES / BOARD_COLUMNS;

  return (
    <div className="overflow-x-auto py-3">
      <div
        role="grid"
        aria-label={label}
        className="relative mx-auto"
        style={
          {
            "--hex": `min(${hexSize}px, calc((100vw - 3rem) / ${BOARD_COLUMNS + 0.5}))`,
            width: `calc(var(--hex) * ${BOARD_COLUMNS + 0.5})`,
            height: `calc(var(--hex) * ${HEX_RATIO} * ${0.75 * (rows - 1) + 1} + 1.25rem)`,
          } as CSSProperties
        }
      >
        {Array.from({ length: BOARD_HEXES }, (_, hex) => {
          const row = Math.floor(hex / BOARD_COLUMNS);
          const column = hex % BOARD_COLUMNS;
          const unit = byHex.get(hex);
          const champion = unit ? index.champions.get(unit.championApiName) : undefined;
          const name = champion?.name ?? unit?.championApiName ?? "";
          const Cell = interactive ? "button" : "div";
          return (
            <Cell
              key={hex}
              type={interactive ? "button" : undefined}
              role="gridcell"
              aria-label={unit ? `${name} ${unit.starLevel}*` : undefined}
              aria-selected={interactive ? selectedHex === hex : undefined}
              data-hex={hex}
              draggable={unit != null && onUnitDragStart != null}
              onClick={onHexClick ? () => onHexClick(hex) : undefined}
              onDragStart={
                unit && onUnitDragStart ? (event) => onUnitDragStart(hex, event) : undefined
              }
              onDragOver={onHexDrop ? (event) => event.preventDefault() : undefined}
              onDrop={onHexDrop ? (event) => onHexDrop(hex, event) : undefined}
              className="absolute"
              style={{
                left: `calc(var(--hex) * ${column + (row % 2 === 1 ? 0.5 : 0)})`,
                top: `calc(var(--hex) * ${HEX_RATIO * 0.75 * row} + 0.75rem)`,
                width: "var(--hex)",
                height: `calc(var(--hex) * ${HEX_RATIO})`,
              }}
            >
              <span
                className={cn(
                  "absolute inset-0.5 block",
                  unit
                    ? (COST_BACKGROUND[champion?.cost ?? 0] ?? "bg-surface/30")
                    : "bg-surface/10",
                  selectedHex === hex ? "bg-primary" : null,
                )}
                style={{ clipPath: HEX_CLIP }}
              >
                {unit ? (
                  <span className="absolute inset-[3px] block" style={{ clipPath: HEX_CLIP }}>
                    <GameIcon
                      path={champion?.icon}
                      alt={name}
                      size={hexSize}
                      className="size-full rounded-none"
                    />
                  </span>
                ) : null}
              </span>
              {unit ? (
                <>
                  <span
                    aria-hidden
                    className="absolute -top-3 left-0 w-full text-center text-xs leading-3 text-primary"
                  >
                    {"*".repeat(unit.starLevel)}
                  </span>
                  <span className="absolute -bottom-2 left-0 flex w-full justify-center gap-px">
                    {unit.items.map((item, position) => {
                      const info = index.items.get(item);
                      return (
                        <GameIcon
                          key={`${item}-${position}`}
                          path={info?.icon}
                          alt={info?.name ?? item}
                          size={16}
                          className="rounded-sm border border-bg"
                        />
                      );
                    })}
                  </span>
                </>
              ) : null}
            </Cell>
          );
        })}
      </div>
    </div>
  );
}
