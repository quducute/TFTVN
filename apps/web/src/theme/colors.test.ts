import cssNamedColors from "color-name";
import { describe, expect, it } from "vitest";
import { C } from "./colors.js";

describe("colors", () => {
  it.each(Object.entries(C))("%s uses a CSS named color", (_token, value) => {
    expect(Object.keys(cssNamedColors)).toContain(value);
  });

  it("keeps the black, gold and white theme", () => {
    expect(C).toMatchObject({ bg: "black", primary: "gold", text: "white" });
  });
});
