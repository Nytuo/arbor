import { defineConfig, devices } from "@playwright/test";

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}/arbor/`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The Rete canvas syncs asynchronously (see src/components/canvas/rete/
  // useTreeEditor.tsx) and drives real pointer gestures for drag/connect
  // tests, so give assertions a bit more room than Playwright's default.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Several tests position cards past y=600 in world space; the default
    // 1280x720 viewport clips those below the fold even though the DOM
    // element still exists and reports a bounding box, which made drag
    // gestures started from that box's midpoint land outside the visible
    // (and thus interactable) canvas area.
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
