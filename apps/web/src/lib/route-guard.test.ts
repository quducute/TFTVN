import { expect, test } from "@playwright/test";
import { isInvalidAppPath, localeOfPath, stripLocale } from "./route-guard";

const ID = "5c2c1930-0000-4000-8000-0000000000ab";

test("accepts every real route shape", () => {
  for (const path of [
    "/",
    "/stats",
    "/stats/master/items",
    "/comps",
    "/comps/latest",
    "/comps/new",
    `/comps/${ID}`,
    `/comps/${ID}/edit`,
    "/articles",
    "/articles/mine",
    `/articles/${ID}`,
    `/articles/${ID}/edit`,
    "/library",
    "/library/18",
    "/library/18/roles",
    "/library/18/champions/DA_18_Shen",
    "/players/Mr%2EX/VN2",
    "/leaderboard",
  ]) {
    expect(isInvalidAppPath(path), path).toBe(false);
  }
});

test("rejects shapes that can never exist", () => {
  for (const path of [
    "/stats/iron/champions",
    "/stats/master/augments",
    "/stats/master",
    "/stats/master/items/extra",
    "/comps/not-a-uuid",
    `/comps/${ID}/share`,
    "/articles/hello",
    `/articles/${ID}/edit/more`,
    "/library/abc",
    "/library/18/skins",
    "/library/18/traits/Anything",
    "/library/18/champions/bad%20name",
    "/library/18/champions/DA_18_Shen/extra",
  ]) {
    expect(isInvalidAppPath(path), path).toBe(true);
  }
});

test("reads and strips the locale prefix", () => {
  const locales = ["vi", "en"];
  expect(localeOfPath("/en/stats", locales, "vi")).toBe("en");
  expect(localeOfPath("/stats", locales, "vi")).toBe("vi");
  expect(stripLocale("/en/stats/master/items", locales)).toBe("/stats/master/items");
  expect(stripLocale("/en", locales)).toBe("/");
  expect(stripLocale("/library/18", locales)).toBe("/library/18");
});
