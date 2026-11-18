import prettier from "eslint-config-prettier/flat";
import { globalIgnores } from "eslint/config";
import globals from "globals";

const rawColorPattern = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

const tftvn = {
  rules: {
    "no-comments": {
      meta: {
        type: "suggestion",
        messages: { comment: "Khong viet comment, chi viet code." },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (comment.type !== "Shebang") {
                context.report({ loc: comment.loc, messageId: "comment" });
              }
            }
          },
        };
      },
    },
    "css-named-colors": {
      meta: {
        type: "problem",
        messages: { color: "Chi dung ten mau CSS chuan, khong dung hex/rgb/hsl." },
        schema: [],
      },
      create(context) {
        const check = (node, value) => {
          if (typeof value === "string" && rawColorPattern.test(value)) {
            context.report({ node, messageId: "color" });
          }
        };
        return {
          Literal: (node) => check(node, node.value),
          TemplateElement: (node) => check(node, node.value.raw),
        };
      },
    },
  },
};

export const shared = [
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/coverage/**",
    "**/next-env.d.ts",
    "packages/db/src/generated/**",
  ]),
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { tftvn },
    rules: {
      "tftvn/no-comments": "error",
      "tftvn/css-named-colors": "error",
    },
  },
  prettier,
];
