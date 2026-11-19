import { expect, test } from "@playwright/test";
import { detectCurrentSet, mainSets } from "./detect-set";
import en from "./fixtures/en_us.json" with { type: "json" };
import teamPlanner from "./fixtures/teamplanner.json" with { type: "json" };
import vi from "./fixtures/vi_vn.json" with { type: "json" };
import { HashResolver, collectVocabulary } from "./hash-resolver";
import { type ParsedSet, parseSet } from "./parse";
import type { RawGameData } from "./types";

const sources = { vi: vi as unknown as RawGameData, en: en as unknown as RawGameData };
const resolver = new HashResolver(collectVocabulary([sources.vi, sources.en]));
const parse = (setNumber: number) => parseSet({ sources, teamPlanner, setNumber, resolver });
const entity = (parsed: ParsedSet, apiName: string) => {
  const found = parsed.entities.find((candidate) => candidate.apiName === apiName);
  if (!found) {
    throw new Error(`missing ${apiName}`);
  }
  return found;
};

test.describe("detectCurrentSet", () => {
  test("only keeps main mutators", () => {
    expect(mainSets(sources.vi).map((set) => set.mutator)).toEqual(["TFTSet17", "TFTSet18"]);
  });

  test("picks the highest main set", () => {
    expect(detectCurrentSet(sources.vi).number).toBe(18);
  });

  test("respects an admin override", () => {
    expect(detectCurrentSet(sources.vi, 17).number).toBe(17);
    expect(() => detectCurrentSet(sources.vi, 99)).toThrow();
  });
});

test.describe("parseSet on Set 18", () => {
  const parsed = parse(18);

  test("keeps only playable champions from the team planner", () => {
    const champions = parsed.entities.filter((candidate) => candidate.kind === "champion");
    expect(champions.map((champion) => champion.apiName).sort()).toEqual([
      "DA_Gromp18_AP",
      "DA_Murkwolf18",
    ]);
  });

  test("maps champion traits to api names and encodes the planner code", () => {
    const gromp = entity(parsed, "DA_Gromp18_AP");
    expect(gromp.traits).toEqual(["DA_Riftbeast18", "DA_18_Adaptor"]);
    expect(gromp.plannerCode).toBe("402");
    expect(gromp.i18n.en.name).toBe("Gromp");
  });

  test("fills row breakpoints of traits", () => {
    const elderwood = entity(parsed, "DA_18_Elderwood");
    expect(elderwood.i18n.vi.description).toContain("<row>(3)");
    expect(elderwood.i18n.vi.description).not.toContain("@");
  });

  test("fills augment placeholders through hashed keys", () => {
    const augment = parsed.entities.find((candidate) => candidate.kind === "augment");
    expect(augment?.i18n.vi.description).not.toMatch(/@|\?/);
  });

  test("reports no missing placeholders outside champion abilities", () => {
    const missing = parsed.report.missingPlaceholders.filter((entry) => entry.kind !== "champion");
    expect(missing).toEqual([]);
  });
});

test.describe("parseSet on Set 17", () => {
  const parsed = parse(17);

  test("expands expandRow breakpoints", () => {
    const description = entity(parsed, "TFT17_Stargazer_Wolf").i18n.vi.description;
    expect(description).toContain("<row>(3)");
    expect(description).toContain("<row>(5)");
    expect(description).not.toContain("<expandRow>");
  });

  test("keeps item recipes and fills item values", () => {
    const emblem = entity(parsed, "TFT17_Item_ASTraitEmblemItem");
    expect(emblem.kind).toBe("item");
    expect(emblem.data.composition).toEqual(["TFT_Item_FryingPan", "TFT_Item_RecurveBow"]);
    expect(emblem.i18n.vi.description).toContain("3 đòn");
    expect(emblem.i18n.vi.description).toContain("5%");
  });

  test("fills augment text even when unused keys stay hashed", () => {
    const augment = entity(parsed, "TFT10_Augment_LittleBuddies");
    expect(augment.kind).toBe("augment");
    expect(augment.i18n.vi.description).toContain("65 Máu");
    expect(augment.i18n.vi.description).toContain("7%");
    expect(parsed.report.unresolvedHashes).toBeGreaterThan(0);
  });

  test("collects roles from playable champions", () => {
    const roles = parsed.entities.filter((candidate) => candidate.kind === "role");
    expect(roles.length).toBeGreaterThan(0);
  });
});
