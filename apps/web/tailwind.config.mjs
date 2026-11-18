import { C } from "./src/theme/colors.js";

const toKebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const config = {
  theme: {
    colors: Object.fromEntries(Object.entries(C).map(([key, value]) => [toKebab(key), value])),
  },
};

export default config;
