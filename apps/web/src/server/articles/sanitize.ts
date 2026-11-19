import sanitizeHtml from "sanitize-html";

const ARTICLE_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "strong",
    "em",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "hr",
  ],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    b: "strong",
    i: "em",
    h1: "h2",
    h4: "h3",
    h5: "h3",
    h6: "h3",
  },
  disallowedTagsMode: "discard",
};

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, ARTICLE_HTML).trim();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

export function plainText(html: string): string {
  return sanitizeHtml(html.replaceAll(/<\/(?:p|h2|h3|li|blockquote|pre)>/g, "$& "), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replaceAll(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function excerpt(html: string, length = 180): string {
  const text = plainText(html);
  return text.length > length ? `${text.slice(0, length).trimEnd()}...` : text;
}
