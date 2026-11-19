export type GameTextNode =
  | { type: "text"; value: string }
  | { type: "break" }
  | { type: "icon"; name: string }
  | { type: "element"; tag: string; children: GameTextNode[] };

const TOKEN = /<br\s*\/?>|<\/?([A-Za-z][\w-]*)[^>]*>|%i:([A-Za-z]+)%/g;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

export function parseGameText(source: string): GameTextNode[] {
  const root: GameTextNode[] = [];
  const stack: { tag: string; children: GameTextNode[] }[] = [];
  const current = () => stack.at(-1)?.children ?? root;
  const pushText = (value: string) => {
    if (value) {
      current().push({ type: "text", value: decodeEntities(value) });
    }
  };

  let cursor = 0;
  for (const match of source.matchAll(TOKEN)) {
    pushText(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const [token, tagName, iconName] = match;

    if (iconName) {
      current().push({ type: "icon", name: iconName });
    } else if (/^<br/i.test(token)) {
      current().push({ type: "break" });
    } else if (tagName && token.startsWith("</")) {
      const index = stack.findLastIndex((open) => open.tag.toLowerCase() === tagName.toLowerCase());
      if (index >= 0) {
        stack.length = index;
      }
    } else if (tagName && token.endsWith("/>")) {
      current().push({ type: "element", tag: tagName, children: [] });
    } else if (tagName) {
      const element = { type: "element" as const, tag: tagName, children: [] as GameTextNode[] };
      current().push(element);
      stack.push(element);
    }
  }
  pushText(source.slice(cursor));
  return root;
}

export function gameTextToPlain(nodes: readonly GameTextNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.value;
        case "break":
          return "\n";
        case "icon":
          return "";
        case "element":
          return gameTextToPlain(node.children);
      }
    })
    .join("");
}
