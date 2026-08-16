import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { buildInfo } from "./buildInfo";

export default defineConfig({
  plugins: [react()],
  define: buildInfo(),
  test: {
    environment: "jsdom",
  },
});