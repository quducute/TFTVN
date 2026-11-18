import { describe, expect, it } from "vitest";
import { catalogs, flattenKeys, getMessagesFor } from "./messages";

describe("messages", () => {
  it("vi and en define the same keys", () => {
    expect(flattenKeys(catalogs.en).sort()).toEqual(flattenKeys(catalogs.vi).sort());
  });

  it("falls back to vi when an en key is missing", () => {
    const merged = getMessagesFor("en");
    expect(flattenKeys(merged).sort()).toEqual(flattenKeys(catalogs.vi).sort());
  });
});
