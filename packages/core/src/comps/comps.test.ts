import { expect, test } from "@playwright/test";
import { decodePlannerCode, encodePlannerCode, isEncodablePlannerCode } from "./planner-code";
import { type CompInput, compInputSchema, toCompFieldErrors } from "./schemas";
import { type TraitRule, countTraits, emblemTrait } from "./traits";

test.describe("planner code", () => {
  test("encodes ten slots padded with empty codes", () => {
    expect(encodePlannerCode(["3e9", "43d"], "TFTSet18")).toBe(
      `023e943d${"000".repeat(8)}TFTSet18`,
    );
  });

  test("skips codes that cannot be encoded and keeps ten slots at most", () => {
    const codes = [
      "000",
      "zzz",
      ...Array.from({ length: 12 }, (_, index) => (index + 1).toString(16).padStart(3, "0")),
    ];
    const encoded = encodePlannerCode(codes, "TFTSet17");
    expect(encoded).toBe(`0200100200300400500600700800900aTFTSet17`);
    expect(isEncodablePlannerCode("000")).toBe(false);
    expect(isEncodablePlannerCode("3E9")).toBe(false);
    expect(isEncodablePlannerCode(null)).toBe(false);
  });

  test("decodes and round-trips", () => {
    const code = encodePlannerCode(["3e9", "40a", "43d"], "TFTSet18");
    expect(decodePlannerCode(` ${code.toUpperCase().replace("TFTSET", "TFTSet")} `)).toEqual({
      codes: ["3e9", "40a", "43d"],
      mutator: "TFTSet18",
    });
  });

  test("rejects malformed codes", () => {
    for (const input of [
      "",
      "01" + "000".repeat(10) + "TFTSet18",
      "02" + "000".repeat(9) + "TFTSet18",
      "02" + "000".repeat(10),
    ]) {
      expect(decodePlannerCode(input)).toBeNull();
    }
  });
});

test.describe("countTraits", () => {
  const rules = new Map<string, TraitRule>([
    [
      "Bruiser",
      {
        breakpoints: [
          { minUnits: 2, style: 1 },
          { minUnits: 4, style: 3 },
          { minUnits: 6, style: 5 },
        ],
      },
    ],
    [
      "Mage",
      {
        breakpoints: [
          { minUnits: 3, style: 1 },
          { minUnits: 5, style: 4 },
        ],
      },
    ],
    ["Unique", { breakpoints: [{ minUnits: 1, style: 3 }] }],
  ]);

  test("counts each champion once and finds the active breakpoint", () => {
    const traits = countTraits(
      [
        { championApiName: "A", traits: ["Bruiser"], emblemTraits: [] },
        { championApiName: "A", traits: ["Bruiser"], emblemTraits: [] },
        { championApiName: "B", traits: ["Bruiser", "Mage"], emblemTraits: [] },
        { championApiName: "C", traits: ["Unique"], emblemTraits: [] },
      ],
      rules,
    );
    expect(traits).toEqual([
      { apiName: "Unique", count: 1, style: 3, activeMinUnits: 1, nextMinUnits: null },
      { apiName: "Bruiser", count: 2, style: 1, activeMinUnits: 2, nextMinUnits: 4 },
      { apiName: "Mage", count: 1, style: 0, activeMinUnits: null, nextMinUnits: 3 },
    ]);
  });

  test("adds emblems only to units without the trait", () => {
    const traits = countTraits(
      [
        { championApiName: "A", traits: ["Bruiser"], emblemTraits: ["Bruiser"] },
        { championApiName: "B", traits: ["Mage"], emblemTraits: ["Bruiser"] },
        { championApiName: "C", traits: ["Mage"], emblemTraits: ["Bruiser", "Bruiser"] },
      ],
      rules,
    );
    expect(traits.find((trait) => trait.apiName === "Bruiser")).toMatchObject({
      count: 3,
      style: 1,
    });
  });

  test("keeps traits without rules as inactive", () => {
    expect(
      countTraits([{ championApiName: "A", traits: ["Ghost"], emblemTraits: [] }], rules),
    ).toEqual([{ apiName: "Ghost", count: 1, style: 0, activeMinUnits: null, nextMinUnits: null }]);
  });
});

test.describe("compInputSchema", () => {
  const valid: CompInput = {
    setId: 18,
    name: "  Đội hình thử  ",
    description: "",
    difficulty: "easy",
    playstyle: null,
    board: [
      { championApiName: "A", starLevel: 2, hex: 0, items: ["X"] },
      { championApiName: "A", starLevel: 1, hex: 1, items: [] },
    ],
    augments: ["Aug1"],
    avatarChampionApiName: "A",
  };

  test("trims text and turns blanks into null", () => {
    const parsed = compInputSchema.parse(valid);
    expect(parsed.name).toBe("Đội hình thử");
    expect(parsed.description).toBeNull();
    expect(parsed.playstyle).toBeNull();
  });

  test("reports error codes by field", () => {
    const result = compInputSchema.safeParse({
      ...valid,
      name: "ab",
      board: [
        { championApiName: "A", starLevel: 4, hex: 0, items: [] },
        { championApiName: "B", starLevel: 1, hex: 40, items: ["1", "2", "3", "4"] },
      ],
      augments: ["Aug1", "Aug1"],
      difficulty: "impossible",
    });
    expect(result.success).toBe(false);
    expect(toCompFieldErrors(result.error!)).toEqual({
      name: "nameTooShort",
      board: "starInvalid",
      difficulty: "difficultyInvalid",
    });
  });

  test("rejects empty, oversized and overlapping boards", () => {
    const codes = (board: unknown) => {
      const result = compInputSchema.safeParse({ ...valid, board, avatarChampionApiName: null });
      return result.success ? null : toCompFieldErrors(result.error).board;
    };
    expect(codes([])).toBe("boardEmpty");
    expect(codes(undefined)).toBe("boardEmpty");
    expect(
      codes(Array.from({ length: 11 }, (_, hex) => ({ championApiName: "A", starLevel: 1, hex }))),
    ).toBe("boardTooLarge");
    expect(
      codes([
        { championApiName: "A", starLevel: 1, hex: 3 },
        { championApiName: "B", starLevel: 1, hex: 3 },
      ]),
    ).toBe("hexTaken");
  });

  test("rejects duplicate augments once the fields are valid", () => {
    const result = compInputSchema.safeParse({ ...valid, augments: ["Aug1", "Aug1"] });
    expect(toCompFieldErrors(result.error!)).toEqual({ augments: "duplicateAugment" });
  });

  test("requires the avatar to be on the board", () => {
    const result = compInputSchema.safeParse({ ...valid, avatarChampionApiName: "Z" });
    expect(toCompFieldErrors(result.error!)).toEqual({ avatarChampionApiName: "avatarNotInBoard" });
  });
});

test("emblemTrait matches the trait named in the item", () => {
  const traits = ["DA_18_Vanguard", "DA_Juggernaut18", "TFT17_Sniper"];
  expect(emblemTrait("DA_18_EmblemVanguard", traits)).toBe("DA_18_Vanguard");
  expect(emblemTrait("DA_JuggernautEmblem18", traits)).toBe("DA_Juggernaut18");
  expect(emblemTrait("TFT17_Item_SniperEmblemItem", traits)).toBeNull();
  expect(emblemTrait("TFT17_SniperEmblem", traits)).toBe("TFT17_Sniper");
  expect(emblemTrait("DA_PhantomEmblem18", traits)).toBeNull();
  expect(emblemTrait("DA_18_Vanguard", traits)).toBeNull();
});
