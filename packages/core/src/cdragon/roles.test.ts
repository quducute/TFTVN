import { expect, test } from "@playwright/test";
import { STANDARD_ROLE_API_NAMES, collectRoleApiNames, effectiveRole } from "./roles";

test.describe("roles", () => {
  test("always offers the standard roles even when game data has none", () => {
    expect(collectRoleApiNames([])).toEqual([...STANDARD_ROLE_API_NAMES].sort());
  });

  test("keeps new roles found in game data", () => {
    expect(collectRoleApiNames(["APTank", "NewRole"])).toContain("NewRole");
  });

  test("prefers the role assigned by an admin", () => {
    expect(effectiveRole("APCarry", "APTank")).toBe("APCarry");
    expect(effectiveRole(null, "APTank")).toBe("APTank");
    expect(effectiveRole(undefined, null)).toBeNull();
  });
});
