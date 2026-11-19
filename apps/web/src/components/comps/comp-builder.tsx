"use client";

import {
  BOARD_HEXES,
  COMP_DIFFICULTIES,
  COMP_PLAYSTYLES,
  type CompErrorCode,
  type CompFieldErrors,
  type CompUnit,
  MAX_BOARD_UNITS,
  MAX_COMP_AUGMENTS,
  MAX_STAR_LEVEL,
  MAX_UNIT_ITEMS,
  decodePlannerCode,
  encodePlannerCode,
} from "@tftvn/core";
import { useTranslations } from "next-intl";
import { type DragEvent, type FormEvent, useId, useMemo, useState } from "react";
import { GameIcon } from "@/components/game-icon";
import { useRouter } from "@/i18n/navigation";
import { api, toApiFailure } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { type CompSetData, boardTraits, indexSetData } from "@/lib/comp-set";
import { compPath } from "@/lib/comp-paths";
import { COST_BORDER } from "@/lib/format";
import type { PublicComp } from "@/server/comps/types";
import { HexBoard } from "./hex-board";
import { PlannerCodeCopy } from "./planner-code-copy";
import { TraitList } from "./trait-list";

type DragPayload =
  | { type: "champion"; apiName: string }
  | { type: "unit"; hex: number }
  | { type: "item"; apiName: string };

const DRAG_TYPE = "application/x-tftvn";

const ITEM_TABS = ["completed", "emblem", "radiant", "artifact", "support"] as const;
type ItemTab = (typeof ITEM_TABS)[number];

const MAX_AUGMENT_RESULTS = 24;

interface CompBuilderProps {
  data: CompSetData;
  initial?: PublicComp;
}

const startDrag = (event: DragEvent<HTMLElement>, payload: DragPayload) => {
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
};

const readDrag = (event: DragEvent<HTMLElement>): DragPayload | null => {
  try {
    return JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as DragPayload;
  } catch {
    return null;
  }
};

const firstFreeHex = (units: readonly CompUnit[]) => {
  const taken = new Set(units.map((unit) => unit.hex));
  for (let hex = 0; hex < BOARD_HEXES; hex += 1) {
    if (!taken.has(hex)) {
      return hex;
    }
  }
  return null;
};

export function CompBuilder({ data, initial }: CompBuilderProps) {
  const t = useTranslations("comps");
  const router = useRouter();
  const index = useMemo(() => indexSetData(data), [data]);
  const ids = {
    name: useId(),
    description: useId(),
    search: useId(),
    augment: useId(),
    code: useId(),
  };

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty ?? "");
  const [playstyle, setPlaystyle] = useState<string>(initial?.playstyle ?? "");
  const [avatar, setAvatar] = useState(initial?.avatarChampionApiName ?? "");
  const [units, setUnits] = useState<CompUnit[]>(initial?.board ?? []);
  const [augments, setAugments] = useState<string[]>(initial?.augments ?? []);
  const [selectedHex, setSelectedHex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [costFilter, setCostFilter] = useState<number | null>(null);
  const [itemTab, setItemTab] = useState<ItemTab>("completed");
  const [augmentSearch, setAugmentSearch] = useState("");
  const [plannerInput, setPlannerInput] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CompFieldErrors>({});
  const [saving, setSaving] = useState(false);

  const errorText = (code: CompErrorCode | "unknown" | undefined) =>
    code ? t(`errors.${code}`) : null;
  const warn = (text: string) => setNotice({ tone: "error", text });

  const selected = selectedHex == null ? null : units.find((unit) => unit.hex === selectedHex);
  const selectedChampion = selected ? index.champions.get(selected.championApiName) : undefined;
  const traits = useMemo(() => boardTraits(units, index), [units, index]);
  const plannerCode = useMemo(() => {
    const codes = units
      .map((unit) => index.champions.get(unit.championApiName)?.plannerCode)
      .filter((code): code is string => code != null);
    return codes.length > 0 ? encodePlannerCode(codes, data.mutator) : null;
  }, [units, index, data.mutator]);

  const normalizedSearch = search.trim().toLowerCase();
  const pool = data.champions.filter(
    (champion) =>
      (costFilter == null || champion.cost === costFilter) &&
      (!normalizedSearch || champion.name.toLowerCase().includes(normalizedSearch)),
  );
  const costs = [...new Set(data.champions.map((champion) => champion.cost))].sort((a, b) => a - b);
  const itemTabs = ITEM_TABS.filter((tab) => data.items.some((item) => item.category === tab));
  const normalizedAugment = augmentSearch.trim().toLowerCase();
  const augmentResults = normalizedAugment
    ? data.augments
        .filter(
          (augment) =>
            !augments.includes(augment.apiName) &&
            augment.name.toLowerCase().includes(normalizedAugment),
        )
        .slice(0, MAX_AUGMENT_RESULTS)
    : [];

  const addChampion = (apiName: string, hex?: number) => {
    setNotice(null);
    if (hex != null && units.some((unit) => unit.hex === hex)) {
      setUnits((current) =>
        current.map((unit) =>
          unit.hex === hex ? { ...unit, championApiName: apiName, items: [] } : unit,
        ),
      );
      return;
    }
    if (units.length >= MAX_BOARD_UNITS) {
      warn(t("builder.boardFull"));
      return;
    }
    const target = hex ?? firstFreeHex(units);
    if (target == null) {
      return;
    }
    setUnits((current) => [
      ...current,
      { championApiName: apiName, starLevel: 1, hex: target, items: [] },
    ]);
    setSelectedHex(target);
  };

  const moveUnit = (from: number, to: number) => {
    if (from === to) {
      return;
    }
    setUnits((current) =>
      current.map((unit) => {
        if (unit.hex === from) {
          return { ...unit, hex: to };
        }
        if (unit.hex === to) {
          return { ...unit, hex: from };
        }
        return unit;
      }),
    );
    setSelectedHex(to);
  };

  const addItem = (apiName: string, hex = selectedHex) => {
    setNotice(null);
    const unit = hex == null ? undefined : units.find((candidate) => candidate.hex === hex);
    if (!unit) {
      warn(t("builder.noSelection"));
      return;
    }
    if (unit.items.length >= MAX_UNIT_ITEMS) {
      warn(t("builder.itemsFull"));
      return;
    }
    setUnits((current) =>
      current.map((candidate) =>
        candidate.hex === unit.hex
          ? { ...candidate, items: [...candidate.items, apiName] }
          : candidate,
      ),
    );
    setSelectedHex(unit.hex);
  };

  const updateSelected = (change: (unit: CompUnit) => CompUnit | null) => {
    if (selectedHex == null) {
      return;
    }
    setUnits((current) =>
      current.flatMap((unit) => {
        if (unit.hex !== selectedHex) {
          return [unit];
        }
        const next = change(unit);
        return next ? [next] : [];
      }),
    );
  };

  const removeSelected = () => {
    const removed = selected?.championApiName;
    updateSelected(() => null);
    setSelectedHex(null);
    if (
      removed &&
      removed === avatar &&
      units.filter((unit) => unit.championApiName === removed).length === 1
    ) {
      setAvatar("");
    }
  };

  const onHexClick = (hex: number) => {
    const occupied = units.some((unit) => unit.hex === hex);
    if (occupied) {
      setSelectedHex((current) => (current === hex ? null : hex));
    } else if (selectedHex != null) {
      moveUnit(selectedHex, hex);
    }
  };

  const onHexDrop = (hex: number, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const payload = readDrag(event);
    if (payload?.type === "champion") {
      addChampion(payload.apiName, hex);
    } else if (payload?.type === "unit") {
      moveUnit(payload.hex, hex);
    } else if (payload?.type === "item") {
      addItem(payload.apiName, hex);
    }
  };

  const importPlanner = () => {
    const decoded = decodePlannerCode(plannerInput);
    if (!decoded) {
      warn(t("errors.plannerCodeInvalid"));
      return;
    }
    if (decoded.mutator !== data.mutator) {
      warn(t("errors.plannerCodeOtherSet"));
      return;
    }
    const byCode = new Map(
      data.champions
        .filter((champion) => champion.plannerCode)
        .map((champion) => [champion.plannerCode!, champion.apiName]),
    );
    const imported = decoded.codes
      .map((code) => byCode.get(code))
      .filter((apiName): apiName is string => apiName != null)
      .slice(0, MAX_BOARD_UNITS)
      .map((apiName, hex): CompUnit => ({
        championApiName: apiName,
        starLevel: 1,
        hex,
        items: [],
      }));
    setUnits(imported);
    setSelectedHex(null);
    setAvatar("");
    setPlannerInput("");
    setNotice({ tone: "success", text: t("builder.imported", { count: imported.length }) });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    setFieldErrors({});
    const body = {
      setId: data.setId,
      name,
      description,
      difficulty: difficulty || null,
      playstyle: playstyle || null,
      avatarChampionApiName: avatar || null,
      board: [...units].sort((left, right) => left.hex - right.hex),
      augments,
    };
    try {
      const response = initial
        ? await api.put<{ comp: PublicComp }>(`/comps/${initial.publicId}`, body)
        : await api.post<{ comp: PublicComp }>("/comps", body);
      router.push(compPath.detail(response.data.comp.publicId));
      router.refresh();
    } catch (error) {
      const failure = toApiFailure<CompErrorCode>(error);
      setFieldErrors(failure.fields);
      warn(errorText(failure.code) ?? "");
      setSaving(false);
    }
  };

  const avatarOptions = [...new Set(units.map((unit) => unit.championApiName))];

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-primary">
          {initial ? t("builder.editTitle") : t("builder.newTitle")}
        </h1>
        <span className="rounded-md border border-primary/40 px-3 py-1.5 text-sm text-primary">
          {t("setLabel", { set: data.setId })}
        </span>
      </div>

      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            notice.tone === "error"
              ? "border-danger/40 text-danger"
              : "border-success/40 text-success",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-4">
          <p className="text-sm text-muted">{t("builder.hint")}</p>
          <HexBoard
            units={units}
            index={index}
            label={t("detail.board")}
            selectedHex={selectedHex}
            onHexClick={onHexClick}
            onHexDrop={onHexDrop}
            onUnitDragStart={(hex, event) => startDrag(event, { type: "unit", hex })}
          />
          {fieldErrors.board ? (
            <p className="text-sm text-danger">{errorText(fieldErrors.board)}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">{t("builder.unitCount", { count: units.length })}</span>
            <button
              type="button"
              onClick={() => {
                setUnits([]);
                setSelectedHex(null);
                setAvatar("");
              }}
              className="text-danger hover:underline"
            >
              {t("builder.clear")}
            </button>
          </div>

          {selected ? (
            <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <p className="font-semibold">
                {t("builder.selected", {
                  name: selectedChampion?.name ?? selected.championApiName,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: MAX_STAR_LEVEL }, (_, position) => position + 1).map(
                  (star) => (
                    <button
                      key={star}
                      type="button"
                      aria-pressed={selected.starLevel === star}
                      onClick={() => updateSelected((unit) => ({ ...unit, starLevel: star }))}
                      className={cn(
                        "rounded-md border px-3 py-1 text-sm",
                        selected.starLevel === star
                          ? "border-primary bg-primary text-on-primary"
                          : "border-line/20 hover:border-primary",
                      )}
                    >
                      {t("builder.star", { star })}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={removeSelected}
                  className="rounded-md border border-danger/60 px-3 py-1 text-sm text-danger hover:bg-danger/10"
                >
                  {t("builder.removeUnit")}
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {selected.items.map((item, position) => {
                  const info = index.items.get(item);
                  const label = t("builder.removeItem", { name: info?.name ?? item });
                  return (
                    <li key={`${item}-${position}`}>
                      <button
                        type="button"
                        title={label}
                        aria-label={label}
                        onClick={() =>
                          updateSelected((unit) => ({
                            ...unit,
                            items: unit.items.filter((_, itemIndex) => itemIndex !== position),
                          }))
                        }
                        className="flex items-center gap-1 rounded-md border border-line/20 p-1 text-xs hover:border-danger"
                      >
                        <GameIcon path={info?.icon} alt="" size={24} />
                        {info?.name ?? item}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <section aria-labelledby="builder-traits" className="space-y-2">
            <h2 id="builder-traits" className="font-semibold text-primary">
              {t("detail.traits")}
            </h2>
            <TraitList traits={traits} index={index} />
          </section>

          <PlannerCodeCopy code={plannerCode} />
          <div className="space-y-1">
            <label htmlFor={ids.code} className="text-sm text-muted">
              {t("builder.importCode")}
            </label>
            <div className="flex gap-2">
              <input
                id={ids.code}
                value={plannerInput}
                onChange={(event) => setPlannerInput(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-line/20 bg-surface/5 px-3 py-2 font-mono text-xs"
              />
              <button
                type="button"
                onClick={importPlanner}
                className="rounded-lg border border-line/20 px-3 py-2 text-sm hover:border-primary hover:text-primary"
              >
                {t("builder.importButton")}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section aria-labelledby="builder-champions" className="space-y-2">
            <h2 id="builder-champions" className="font-semibold text-primary">
              {t("builder.champions")}
            </h2>
            <label htmlFor={ids.search} className="sr-only">
              {t("builder.search")}
            </label>
            <input
              id={ids.search}
              type="search"
              value={search}
              placeholder={t("builder.search")}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-line/20 bg-surface/5 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex flex-wrap gap-1 text-xs">
              {[null, ...costs].map((cost) => (
                <button
                  key={cost ?? "all"}
                  type="button"
                  aria-pressed={costFilter === cost}
                  onClick={() => setCostFilter(cost)}
                  className={cn(
                    "rounded-md border px-2 py-1",
                    costFilter === cost
                      ? "border-primary text-primary"
                      : "border-line/20 text-muted",
                  )}
                >
                  {cost == null ? t("builder.allCosts") : t("builder.cost", { cost })}
                </button>
              ))}
            </div>
            <ul className="grid max-h-80 grid-cols-6 gap-1.5 overflow-y-auto pr-1">
              {pool.map((champion) => (
                <li key={champion.apiName}>
                  <button
                    type="button"
                    title={champion.name}
                    aria-label={champion.name}
                    draggable
                    onDragStart={(event) =>
                      startDrag(event, { type: "champion", apiName: champion.apiName })
                    }
                    onClick={() => addChampion(champion.apiName)}
                    className="block"
                  >
                    <GameIcon
                      path={champion.icon}
                      alt=""
                      size={44}
                      className={cn("border-2", COST_BORDER[champion.cost] ?? "border-line/20")}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="builder-items" className="space-y-2">
            <h2 id="builder-items" className="font-semibold text-primary">
              {t("builder.items")}
            </h2>
            <div role="tablist" className="flex flex-wrap gap-1 text-xs">
              {itemTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={itemTab === tab}
                  onClick={() => setItemTab(tab)}
                  className={cn(
                    "rounded-md border px-2 py-1",
                    itemTab === tab ? "border-primary text-primary" : "border-line/20 text-muted",
                  )}
                >
                  {t(`builder.itemCategories.${tab}`)}
                </button>
              ))}
            </div>
            <ul role="tabpanel" className="grid max-h-60 grid-cols-8 gap-1 overflow-y-auto pr-1">
              {data.items
                .filter((item) => item.category === itemTab)
                .map((item) => (
                  <li key={item.apiName}>
                    <button
                      type="button"
                      title={item.name}
                      aria-label={item.name}
                      draggable
                      onDragStart={(event) =>
                        startDrag(event, { type: "item", apiName: item.apiName })
                      }
                      onClick={() => addItem(item.apiName)}
                      className="block"
                    >
                      <GameIcon path={item.icon} alt="" size={34} />
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        </aside>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={ids.name} className="mb-1 block text-sm text-muted">
            {t("builder.name")}
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={fieldErrors.name ? true : undefined}
            className={cn(
              "w-full rounded-lg border bg-surface/5 px-3 py-2 outline-none focus:border-primary",
              fieldErrors.name ? "border-danger" : "border-line/20",
            )}
          />
          {fieldErrors.name ? (
            <p className="mt-1 text-sm text-danger">{errorText(fieldErrors.name)}</p>
          ) : null}
        </div>
        <SelectField
          label={t("builder.avatar")}
          value={avatar}
          onChange={setAvatar}
          error={errorText(fieldErrors.avatarChampionApiName)}
          options={[
            { value: "", label: t("builder.avatarAuto") },
            ...avatarOptions.map((apiName) => ({
              value: apiName,
              label: index.champions.get(apiName)?.name ?? apiName,
            })),
          ]}
        />
        <SelectField
          label={t("difficulty.label")}
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: "", label: t("difficulty.none") },
            ...COMP_DIFFICULTIES.map((value) => ({ value, label: t(`difficulty.${value}`) })),
          ]}
        />
        <SelectField
          label={t("playstyle.label")}
          value={playstyle}
          onChange={setPlaystyle}
          options={[
            { value: "", label: t("playstyle.none") },
            ...COMP_PLAYSTYLES.map((value) => ({ value, label: t(`playstyle.${value}`) })),
          ]}
        />
        <div className="md:col-span-2">
          <label htmlFor={ids.description} className="mb-1 block text-sm text-muted">
            {t("builder.descriptionField")}
          </label>
          <textarea
            id={ids.description}
            value={description}
            rows={4}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-line/20 bg-surface/5 px-3 py-2 outline-none focus:border-primary"
          />
          {fieldErrors.description ? (
            <p className="mt-1 text-sm text-danger">{errorText(fieldErrors.description)}</p>
          ) : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <label htmlFor={ids.augment} className="block text-sm text-muted">
            {t("builder.augmentsField")}
          </label>
          <ul className="flex flex-wrap gap-2">
            {augments.map((apiName) => {
              const info = index.augments.get(apiName);
              const label = t("builder.removeItem", { name: info?.name ?? apiName });
              return (
                <li key={apiName}>
                  <button
                    type="button"
                    aria-label={label}
                    title={label}
                    onClick={() =>
                      setAugments((current) => current.filter((value) => value !== apiName))
                    }
                    className="flex items-center gap-2 rounded-lg border border-primary/40 px-2 py-1 text-sm hover:border-danger"
                  >
                    <GameIcon path={info?.icon} alt="" size={24} />
                    {info?.name ?? apiName}
                  </button>
                </li>
              );
            })}
          </ul>
          {augments.length < MAX_COMP_AUGMENTS ? (
            <>
              <input
                id={ids.augment}
                type="search"
                value={augmentSearch}
                placeholder={t("builder.search")}
                onChange={(event) => setAugmentSearch(event.target.value)}
                className="w-full rounded-lg border border-line/20 bg-surface/5 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {augmentResults.map((augment) => (
                  <li key={augment.apiName}>
                    <button
                      type="button"
                      onClick={() => {
                        setAugments((current) => [...current, augment.apiName]);
                        setAugmentSearch("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border border-line/10 px-2 py-1 text-left text-sm hover:border-primary"
                    >
                      <GameIcon path={augment.icon} alt="" size={24} />
                      {augment.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {fieldErrors.augments ? (
            <p className="text-sm text-danger">{errorText(fieldErrors.augments)}</p>
          ) : null}
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {saving ? t("builder.saving") : t("builder.save")}
      </button>
    </form>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string | null;
}>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line/20 bg-bg px-3 py-2 outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
