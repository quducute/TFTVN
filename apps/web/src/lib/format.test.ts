import { expect, test } from "@playwright/test";
import { formatStatRow } from "./format";

test("formatStatRow shows mana as initial over max", () => {
  expect(formatStatRow("mana", { initialMana: 30, mana: 90 })).toBe("30/90");
  expect(formatStatRow("mana", { mana: 60 })).toBe("0/60");
});

test("formatStatRow formats the other stats", () => {
  const stats = { attackSpeed: 0.65, critChance: 0.25, hp: 899.6, range: null };
  expect(formatStatRow("attackSpeed", stats)).toBe("0.65");
  expect(formatStatRow("critChance", stats)).toBe("25%");
  expect(formatStatRow("hp", stats)).toBe("900");
  expect(formatStatRow("range", stats)).toBe("-");
});
