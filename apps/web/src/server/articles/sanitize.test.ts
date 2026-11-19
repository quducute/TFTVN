import { expect, test } from "@playwright/test";
import { excerpt, plainText, sanitizeArticleHtml } from "./sanitize";

test.describe("sanitizeArticleHtml", () => {
  test("removes scripts, handlers and unsafe links", () => {
    const html = sanitizeArticleHtml(
      '<p onclick="steal()">Xin chào<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><iframe src="https://evil"></iframe>',
    );
    expect(html).toBe('<p>Xin chào</p><a rel="noopener noreferrer nofollow" target="_blank">x</a>');
  });

  test("keeps formatting and hardens links", () => {
    expect(
      sanitizeArticleHtml(
        '<h1>Tiêu đề</h1><p><b>đậm</b> <i>nghiêng</i> <a href="https://tftvn.dev" target="_self" style="color:red">link</a></p><ul><li>một</li></ul>',
      ),
    ).toBe(
      '<h2>Tiêu đề</h2><p><strong>đậm</strong> <em>nghiêng</em> <a href="https://tftvn.dev" target="_blank" rel="noopener noreferrer nofollow">link</a></p><ul><li>một</li></ul>',
    );
  });

  test("drops classes and inline styles", () => {
    expect(sanitizeArticleHtml('<p class="x" style="color:red">a</p>')).toBe("<p>a</p>");
  });
});

test.describe("plain text helpers", () => {
  test("separates blocks with spaces and decodes text", () => {
    expect(plainText("<h2>Một</h2><p>Hai&nbsp;&amp; ba</p><ul><li>bốn</li></ul>")).toBe(
      "Một Hai & ba bốn",
    );
  });

  test("shortens long text at the limit", () => {
    expect(excerpt(`<p>${"a".repeat(30)}</p>`, 10)).toBe("aaaaaaaaaa...");
    expect(excerpt("<p>ngắn</p>", 10)).toBe("ngắn");
  });
});
