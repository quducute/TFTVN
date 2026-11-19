import { expect, test } from "@playwright/test";
import { gameTextToPlain, parseGameText } from "./game-text";

test.describe("parseGameText", () => {
  test("turns markup into a tree", () => {
    expect(parseGameText("Deal <magicDamage>300 (%i:scaleAP%)</magicDamage><br>end")).toEqual([
      { type: "text", value: "Deal " },
      {
        type: "element",
        tag: "magicDamage",
        children: [
          { type: "text", value: "300 (" },
          { type: "icon", name: "scaleAP" },
          { type: "text", value: ")" },
        ],
      },
      { type: "break" },
      { type: "text", value: "end" },
    ]);
  });

  test("decodes entities and keeps unknown text intact", () => {
    expect(parseGameText("A&nbsp;&amp;&nbsp;B")).toEqual([{ type: "text", value: "A & B" }]);
  });

  test("closes tags case-insensitively and survives stray closing tags", () => {
    const nodes = parseGameText("<TFTKeyword>Hi</tftkeyword></rules> there");
    expect(gameTextToPlain(nodes)).toBe("Hi there");
    expect(nodes[0]).toMatchObject({ type: "element", tag: "TFTKeyword" });
  });

  test("never produces raw html", () => {
    const nodes = parseGameText('<img src=x onerror="alert(1)">text');
    expect(nodes).toEqual([
      { type: "element", tag: "img", children: [{ type: "text", value: "text" }] },
    ]);
  });
});
