import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { buildInfo } from "./buildInfo.ts";

export default defineConfig(({ mode }) => {
  const buildDefinitions = buildInfo();
  const testDefinitions: Record<string, string> = mode === "test"
    ? { "import.meta.env.VITE_CONTACT_EMAIL": JSON.stringify("test-contact@example.invalid") }
    : {};
  const definitions = { ...buildDefinitions, ...testDefinitions };

  return {
    plugins: [react()],
    define: definitions,
    oxc: { define: definitions },
    test: {
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      exclude: ["**/node_modules/**", "**/dist/**", "api/**"],
    },
  };
});
