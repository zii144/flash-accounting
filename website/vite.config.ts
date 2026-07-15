import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

// Deployed to GitHub Pages at https://zii144.github.io/flash-accounting/.
// Override with WEBSITE_BASE=/ (or a custom domain path) when hosting elsewhere.
export default defineConfig({
  base: process.env.WEBSITE_BASE ?? "/flash-accounting/",
  build: {
    rolldownOptions: {
      input: {
        index: resolve(root, "index.html"),
        privacy: resolve(root, "privacy.html"),
        terms: resolve(root, "terms.html"),
        support: resolve(root, "support.html"),
      },
    },
  },
});
