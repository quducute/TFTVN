import { describe, expect, it } from "vitest";
import { STANDARD_ROLE_API_NAMES, collectRoleApiNames, effectiveRole } from "./roles";

describe("roles", () => {
  it("always offers the standard roles even when game data has none", () => {
    expect(collectRoleApiNames([])).toEqual([...STANDARD_ROLE_API_NAMES].sort());
  });

  it("keeps new roles found in game data", () => {
    expect(collectRoleApiNames(["APTank", "NewRole"])).toContain("NewRole");
  });

  it("prefers the role assigned by an admin", () => {
    expect(effectiveRole("APCarry", "APTank")).toBe("APCarry");
    expect(effectiveRole(null, "APTank")).toBe("APTank");
    expect(effectiveRole(undefined, null)).toBeNull();
  });
});
