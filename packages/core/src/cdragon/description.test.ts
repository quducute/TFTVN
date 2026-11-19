import { expect, test } from "@playwright/test";
import { UNKNOWN_VALUE, renderDescription, renderTraitDescription } from "./description";
import { hashedKey } from "./fnv";

test.describe("renderDescription", () => {
  test("fills values and applies multipliers", () => {
    const result = renderDescription("+@AS@% / @Heal*100@%", { AS: 30, Heal: 0.05000000074505806 });
    expect(result).toEqual({ text: "+30% / 5%", missing: [] });
  });

  test("matches placeholders without caring about case", () => {
    expect(renderDescription("@health@", { Health: 65 }).text).toBe("65");
  });

  test("finds values stored under the hash of the placeholder name", () => {
    expect(renderDescription("@SecretValue@", { [hashedKey("SecretValue")]: 4 }).text).toBe("4");
  });

  test("shows star levels 1 to 3 for champion variables", () => {
    const values = { Damage: [100, 300, 480, 750, 1125, 100, 100] };
    expect(renderDescription("@Damage@", values).text).toBe("300/480/750");
  });

  test("collapses equal star levels into one number", () => {
    expect(renderDescription("@Radius@", { Radius: [2, 2, 2, 2] }).text).toBe("2");
  });

  test("marks runtime values as unknown without reporting them", () => {
    const result = renderDescription("(@TFTUnitProperty.trait:Gold@)", {});
    expect(result).toEqual({ text: `(${UNKNOWN_VALUE})`, missing: [] });
  });

  test("reports placeholders that have no value", () => {
    const result = renderDescription("@ModifiedDamage@", { Damage: [1, 2, 3, 4] });
    expect(result).toEqual({ text: UNKNOWN_VALUE, missing: ["ModifiedDamage"] });
  });
});

test.describe("renderTraitDescription", () => {
  const effects = [
    { minUnits: 2, maxUnits: 3, style: 1, variables: { Bonus: 10 } },
    { minUnits: 4, maxUnits: 25000, style: 3, variables: { Bonus: 25 } },
  ];
  const identity = (values: Record<string, number | null> | null) => values ?? {};

  test("fills each row with its own breakpoint", () => {
    const text =
      "Head @Bonus@<br><row>(@MinUnits@) @Bonus@</row><br><row>(@MinUnits@) @Bonus@</row>";
    expect(renderTraitDescription(text, effects, identity).text).toBe(
      "Head 10<br><row>(2) 10</row><br><row>(4) 25</row>",
    );
  });

  test("expands expandRow once per breakpoint", () => {
    const text = "<expandRow>(@MinUnits@) +@Bonus@</expandRow>";
    expect(renderTraitDescription(text, effects, identity).text).toBe(
      "<row>(2) +10</row><br><row>(4) +25</row>",
    );
  });
});
