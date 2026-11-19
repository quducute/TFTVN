import { expect, test } from "@playwright/test";
import cssNamedColors from "color-name";
import { C } from "./colors.js";

const namedColors = Object.keys(cssNamedColors);

test.describe("colors", () => {
  for (const [token, value] of Object.entries(C)) {
    test(`${token} uses a CSS named color`, () => {
      expect(namedColors).toContain(value);
    });
  }

  test("keeps the black, gold and white theme", () => {
    expect(C).toMatchObject({ bg: "black", primary: "gold", text: "white" });
  });
});
