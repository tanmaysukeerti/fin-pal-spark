import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Don't load .env — tests run against the in-memory repo, never live Neon.
    env: {},
  },
});
