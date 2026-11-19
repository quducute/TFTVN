import { expect, test } from "@playwright/test";
import { catalogs, flattenKeys, getMessagesFor } from "./messages";

test.describe("messages", () => {
  test("vi and en define the same keys", () => {
    expect(flattenKeys(catalogs.en).sort()).toEqual(flattenKeys(catalogs.vi).sort());
  });

  test("falls back to vi when an en key is missing", () => {
    const merged = getMessagesFor("en");
    expect(flattenKeys(merged).sort()).toEqual(flattenKeys(catalogs.vi).sort());
  });
});
