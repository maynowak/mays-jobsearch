import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { buildInfo } from "./buildInfo.ts";

export default defineConfig({
  plugins: [react()],
  define: buildInfo(),
  oxc: { define: buildInfo() },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
  },
  optimizeDeps: {
    exclude: ["api/**"],
  },
  build: {
    rollupOptions: {
      external: ["api/**"],
      // Two HTML shells:
      // - index.html carries the landing-page SEO metadata and a canonical URL.
      // - app.html is the metadata-neutral shell for application routes, which
      //   are excluded from indexing via X-Robots-Tag and meta robots.
      input: {
        index: resolve(process.cwd(), "index.html"),
        app: resolve(process.cwd(), "app.html"),
      },
    },
  },
});
