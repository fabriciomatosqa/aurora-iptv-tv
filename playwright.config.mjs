import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 35_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"],["html",{open:"never"}]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    viewport: {width:1920,height:1080},
    baseURL:"http://127.0.0.1:8080",
    screenshot:"only-on-failure",
    trace:"retain-on-failure"
  },
  webServer: {
    command:"python3 -m http.server 8080 --bind 127.0.0.1",
    url:"http://127.0.0.1:8080",
    reuseExistingServer: !process.env.CI,
    timeout:30_000
  }
});
