// The port is chosen at run time, never written down: a fixed one collides with
// whatever else the machine is running, and CI would fail for a reason that has
// nothing to do with the app.
const { execFileSync } = require('child_process');
const { defineConfig, devices } = require('@playwright/test');

// Asking the OS for a free port is asynchronous, and a config file has to
// answer straight away — so ask in a throwaway process and read the number back.
function freePort() {
  const script = "const s=require('net').createServer();"
    + "s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close()});";
  return Number(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim());
}

// The runner and every worker load this file in their own process. Pin the
// number in the environment the first time so they all agree — otherwise each
// worker invents a port and looks for the site where nothing is listening.
const PORT = Number(process.env.PORT) || freePort();
process.env.PORT = String(PORT);
const BASE = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  // Only the browser specs. The fast tests next door are named *.test.js and are
  // run by `node --test`, which needs no browser and answers in a second —
  // Playwright's default pattern would sweep them up and fail on a missing page.
  testMatch: '**/*.spec.js',
  // Nothing here talks to a real network, so the whole suite can run at once.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'node scripts/serve.js',
    url: BASE,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  },
});
