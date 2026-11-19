import { z } from "zod";

export const BOARD_ROWS = 4;
export const BOARD_COLUMNS = 7;
export const BOARD_HEXES = BOARD_ROWS * BOARD_COLUMNS;
export const MAX_BOARD_UNITS = 10;
export const MAX_UNIT_ITEMS = 3;
export const MAX_COMP_AUGMENTS = 3;
export const MAX_STAR_LEVEL = 3;

export const COMP_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const COMP_PLAYSTYLES = ["standard", "fast8", "fast9", "reroll"] as const;
export const META_TIERS = ["S", "A", "B", "C", "X"] as const;

export type CompDifficulty = (typeof COMP_DIFFICULTIES)[number];
export type CompPlaystyle = (typeof COMP_PLAYSTYLES)[number];
export type MetaTier = (typeof META_TIERS)[number];

export const COMP_ERROR_CODES = [
  "required",
  "nameTooShort",
  "nameTooLong",
  "descriptionTooLong",
  "boardEmpty",
  "boardTooLarge",
  "hexInvalid",
  "hexTaken",
  "starInvalid",
  "tooManyItems",
  "tooManyAugments",
  "duplicateAugment",
  "avatarNotInBoard",
  "difficultyInvalid",
  "playstyleInvalid",
  "setInvalid",
  "unknownChampion",
  "unknownItem",
  "unknownAugment",
  "plannerCodeInvalid",
  "plannerCodeOtherSet",
  "tierInvalid",
  "compNotFound",
  "compIsMeta",
  "forbidden",
  "unauthorized",
  "forbiddenOrigin",
  "rateLimited",
  "unknown",
] as const;

export type CompErrorCode = (typeof COMP_ERROR_CODES)[number];
export type CompFieldErrors = Partial<Record<string, CompErrorCode>>;

const KNOWN_CODES = new Set<string>(COMP_ERROR_CODES);
const required = { error: "required" } as const;

export const compUnitSchema = z.object({
  championApiName: z.string(required).min(1, required),
  starLevel: z
    .number({ error: "starInvalid" })
    .int({ error: "starInvalid" })
    .min(1, { error: "starInvalid" })
    .max(MAX_STAR_LEVEL, { error: "starInvalid" }),
  hex: z
    .number({ error: "hexInvalid" })
    .int({ error: "hexInvalid" })
    .min(0, { error: "hexInvalid" })
    .max(BOARD_HEXES - 1, { error: "hexInvalid" }),
  items: z.array(z.string().min(1)).max(MAX_UNIT_ITEMS, { error: "tooManyItems" }).default([]),
});

export type CompUnit = z.infer<typeof compUnitSchema>;

const optionalText = (max: number, code: CompErrorCode) =>
  z
    .string()
    .trim()
    .max(max, { error: code })
    .nullish()
    .transform((value) => (value ? value : null));

export const compInputSchema = z
  .object({
    setId: z.number({ error: "setInvalid" }).int({ error: "setInvalid" }).positive({
      error: "setInvalid",
    }),
    name: z
      .string(required)
      .trim()
      .min(3, { error: "nameTooShort" })
      .max(60, { error: "nameTooLong" }),
    description: optionalText(2000, "descriptionTooLong"),
    difficulty: z
      .enum(COMP_DIFFICULTIES, { error: "difficultyInvalid" })
      .nullish()
      .transform((value) => value ?? null),
    playstyle: z
      .enum(COMP_PLAYSTYLES, { error: "playstyleInvalid" })
      .nullish()
      .transform((value) => value ?? null),
    board: z
      .array(compUnitSchema, { error: "boardEmpty" })
      .min(1, { error: "boardEmpty" })
      .max(MAX_BOARD_UNITS, { error: "boardTooLarge" }),
    augments: z
      .array(z.string().min(1))
      .max(MAX_COMP_AUGMENTS, { error: "tooManyAugments" })
      .default([]),
    avatarChampionApiName: z
      .string()
      .nullish()
      .transform((value) => value || null),
  })
  .superRefine((value, context) => {
    const hexes = value.board.map((unit) => unit.hex);
    if (new Set(hexes).size !== hexes.length) {
      context.addIssue({ code: "custom", path: ["board"], message: "hexTaken" });
    }
    if (new Set(value.augments).size !== value.augments.length) {
      context.addIssue({ code: "custom", path: ["augments"], message: "duplicateAugment" });
    }
    if (
      value.avatarChampionApiName &&
      !value.board.some((unit) => unit.championApiName === value.avatarChampionApiName)
    ) {
      context.addIssue({
        code: "custom",
        path: ["avatarChampionApiName"],
        message: "avatarNotInBoard",
      });
    }
  });

export type CompInput = z.infer<typeof compInputSchema>;

export const metaTierSchema = z.object({
  tier: z.enum(META_TIERS, { error: "tierInvalid" }).nullable(),
});

export function toCompFieldErrors(error: z.ZodError): CompFieldErrors {
  const errors: CompFieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (errors[field] == null) {
      errors[field] = KNOWN_CODES.has(issue.message) ? (issue.message as CompErrorCode) : "unknown";
    }
  }
  return errors;
}
