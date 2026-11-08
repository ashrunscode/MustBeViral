import { defineConfig } from "vitest/config";

// Unit tests run in Node with a fake D1 and a fake asset binding.
// scripts/check-site.mjs and `wrangler dev` cover the real runtime and local D1.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
