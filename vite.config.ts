import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { buildInfo } from "./buildInfo";

export default defineConfig({
  plugins: [react()],
  define: buildInfo(),
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
});