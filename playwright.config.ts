import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a real production build in headless Chromium.
 *
 * That matters more here than in a typical web app: every tool is canvas and
 * WebAssembly work executed by the browser itself, so a passing type-check
 * proves almost nothing about whether an image actually compresses. These tests
 * are the only thing that exercises the real pipeline.
 */

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
