import { defineConfig, devices } from "@playwright/test";

// E2E tests run against a production build (`npm run build` first).
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: true,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 5"] } }, // low-end Android is the main target
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
