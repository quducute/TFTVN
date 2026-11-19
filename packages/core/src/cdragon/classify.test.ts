import { expect, test } from "@playwright/test";
import { type AugmentTier, type ItemCategory, augmentTier, itemCategory } from "./classify";

const ITEM_CASES: [string, string[], string[], ItemCategory][] = [
  ["TFT_Item_BFSword", [], ["component"], "component"],
  ["TFT_Item_InfinityEdge", ["TFT_Item_BFSword", "TFT_Item_SparringGloves"], [], "completed"],
  ["TFT17_Item_ASTraitEmblemItem", ["TFT_Item_FryingPan", "TFT_Item_RecurveBow"], [], "emblem"],
  ["TFT5_Item_InfinityEdgeRadiant", [], [], "radiant"],
  ["TFT_Item_Artifact_Fishbones", [], [], "artifact"],
  ["TFT11_Item_ThiefsGlovesSupport", [], [], "support"],
  ["TFT_Consumable_ItemRemover", [], ["Consumable"], "consumable"],
  ["TFT18_Barrier18", [], [], "other"],
];

const AUGMENT_CASES: [string | null, AugmentTier | null][] = [
  ["assets/maps/tft/icons/augments/hexcore/little-buddies-ii.tex", 2],
  ["caretaker_s-chosen-i.tex", 1],
  ["duoqueue_iii.TEX", 3],
  ["missing-t2.tex", 2],
  ["something.tex", null],
  [null, null],
];

test.describe("itemCategory", () => {
  for (const [apiName, composition, tags, expected] of ITEM_CASES) {
    test(`${apiName} is ${expected}`, () => {
      expect(itemCategory({ apiName, composition, tags })).toBe(expected);
    });
  }
});

test.describe("augmentTier", () => {
  for (const [icon, expected] of AUGMENT_CASES) {
    test(`${icon} -> ${expected}`, () => {
      expect(augmentTier(icon)).toBe(expected);
    });
  }
});
