import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/lg-webos",
  timeout: 40_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", {open: "never", outputFolder: "dist/lg-visual-report"}]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:8092",
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "python3 -m http.server 8092 --bind 127.0.0.1 --directory dist/lg-webos",
    url: "http://127.0.0.1:8092",
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
