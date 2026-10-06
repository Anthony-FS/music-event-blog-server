import { defineConfig } from "vitest/config";

// End-to-end suites: e2e/mocked is hermetic, e2e/smoke.test.mjs hits the live API.
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.test.mjs"],
  },
});
