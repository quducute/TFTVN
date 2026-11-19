import { expect, test } from "@playwright/test";
import { AUTH_ERROR_CODES } from "@tftvn/core";
import { catalogs, flattenKeys, getMessagesFor } from "./messages";

test.describe("messages", () => {
  test("vi and en define the same keys", () => {
    expect(flattenKeys(catalogs.en).sort()).toEqual(flattenKeys(catalogs.vi).sort());
  });

  test("falls back to vi when an en key is missing", () => {
    const merged = getMessagesFor("en");
    expect(flattenKeys(merged).sort()).toEqual(flattenKeys(catalogs.vi).sort());
  });

  test("every auth error code has a message", () => {
    const keys = new Set(flattenKeys(catalogs.vi));
    const missing = AUTH_ERROR_CODES.filter((code) => !keys.has(`auth.errors.${code}`));
    expect(missing).toEqual([]);
  });
});
