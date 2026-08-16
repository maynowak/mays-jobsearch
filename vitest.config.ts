import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { buildInfo } from "./buildInfo.ts";

export default defineConfig({
  plugins: [react()],
  define: buildInfo(),
  oxc: { define: buildInfo() },
  test: {
    environment: "jsdom",
  },
});