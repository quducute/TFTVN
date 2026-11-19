import { expect, test } from "@playwright/test";
import type { z } from "zod";
import {
  articleInputSchema,
  articleReviewSchema,
  reactionSchema,
  toArticleFieldErrors,
} from "./schemas";

const valid = {
  title: "  Hướng dẫn leo rank  ",
  category: "guide",
  setId: 18,
  tags: ["Meta", "meta", "set-18"],
  body: "<p>Nội dung</p>",
  compIds: ["00000000-0000-4000-8000-00000000000A", "00000000-0000-4000-8000-00000000000a"],
};

const fieldErrors = (input: unknown, schema: z.ZodType = articleInputSchema) => {
  const result = schema.safeParse(input);
  return result.success ? null : toArticleFieldErrors(result.error);
};

test.describe("articleInputSchema", () => {
  test("trims the title and dedupes tags and comps", () => {
    const parsed = articleInputSchema.parse(valid);
    expect(parsed.title).toBe("Hướng dẫn leo rank");
    expect(parsed.tags).toEqual(["meta", "set-18"]);
    expect(parsed.compIds).toEqual(["00000000-0000-4000-8000-00000000000a"]);
  });

  test("allows articles without a set", () => {
    expect(articleInputSchema.parse({ ...valid, setId: undefined }).setId).toBeNull();
  });

  test("reports error codes by field", () => {
    expect(
      fieldErrors({
        title: "abc",
        category: "rumor",
        setId: -1,
        tags: ["a", "ok"],
        body: 5,
        compIds: ["nope"],
      }),
    ).toEqual({
      title: "titleTooShort",
      category: "categoryInvalid",
      setId: "setInvalid",
      tags: "tagInvalid",
      body: "required",
      compIds: "compInvalid",
    });
    expect(fieldErrors({ ...valid, tags: ["a1", "b2", "c3", "d4", "e5", "f6"] })).toEqual({
      tags: "tooManyTags",
    });
    expect(fieldErrors({ ...valid, tags: ["có dấu cách"] })).toEqual({ tags: "tagInvalid" });
  });
});

test.describe("review and reaction schemas", () => {
  test("requires a note when rejecting", () => {
    expect(fieldErrors({ status: "rejected" }, articleReviewSchema)).toEqual({
      note: "noteRequired",
    });
    expect(articleReviewSchema.parse({ status: "approved", note: "  " }).note).toBeNull();
    expect(fieldErrors({ status: "queued" }, articleReviewSchema)).toEqual({
      status: "reviewInvalid",
    });
  });

  test("accepts a reaction kind or null", () => {
    expect(reactionSchema.parse({ kind: null }).kind).toBeNull();
    expect(reactionSchema.parse({ kind: "heart" }).kind).toBe("heart");
    expect(reactionSchema.safeParse({ kind: "angry" }).success).toBe(false);
  });
});
