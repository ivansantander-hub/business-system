/**
 * Starts the dev server, waits for it to be ready, runs all test suites,
 * uploads results to R2, then shuts the server down.
 *
 * Usage: node scripts/run-all-tests.js
 */
const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const MAX_WAIT_MS = 120_000;
const POLL_INTERVAL_MS = 2000;

function log(msg) {
  const ts = new Date().toLocaleTimeString("es-CO", { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/login`, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer() {
  log(`Waiting for server on port ${PORT}...`);
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    if (await checkServer()) {
      log("Server is ready!");
      return true;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  log("Server did not start in time.");
  return false;
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    log(`Running: ${cmd} ${args.join(" ")}`);
    const proc = spawn(cmd, args, {
      stdio: opts.captureOutput ? ["pipe", "pipe", "pipe"] : "inherit",
      shell: true,
      cwd: path.join(__dirname, ".."),
    });

    let stdout = "";
    let stderr = "";
    if (opts.captureOutput) {
      proc.stdout.on("data", (d) => { stdout += d; process.stdout.write(d); });
      proc.stderr.on("data", (d) => { stderr += d; process.stderr.write(d); });
    }

    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function main() {
  let serverProc = null;
  let exitCode = 0;

  try {
    const alreadyRunning = await checkServer();

    if (!alreadyRunning) {
      log("Starting dev server...");
      serverProc = spawn("npx", ["next", "dev", "--turbopack", "-p", String(PORT)], {
        stdio: "pipe",
        shell: true,
        cwd: path.join(__dirname, ".."),
        detached: false,
      });
      serverProc.stdout.on("data", () => {});
      serverProc.stderr.on("data", () => {});

      const ready = await waitForServer();
      if (!ready) {
        log("ERROR: Server failed to start. Aborting.");
        process.exit(1);
      }
    } else {
      log("Server already running on port " + PORT);
    }

    // Run Vitest tests and capture output
    log("\n========== VITEST TESTS ==========\n");
    const vitestLogPath = path.join(__dirname, "..", "tests", "vitest-output.txt");
    const vitest = await runCommand("npx", ["vitest", "run", "--reporter=verbose"], { captureOutput: true });
    fs.writeFileSync(vitestLogPath, vitest.stdout + "\n" + vitest.stderr, "utf-8");
    if (vitest.code !== 0) {
      log(`Vitest exited with code ${vitest.code}`);
      exitCode = 1;
    }

    // Run Python E2E tests
    log("\n========== E2E TESTS (Python) ==========\n");
    const e2e = await runCommand("python", ["tests/e2e.py"]);
    if (e2e.code !== 0) {
      log(`E2E tests exited with code ${e2e.code}`);
      exitCode = 1;
    }

    // Upload results to R2
    log("\n========== UPLOADING TO R2 ==========\n");
    await runCommand("node", ["scripts/upload-test-logs.js"]);

    log("\n========== COMPLETE ==========");
    log(exitCode === 0 ? "All tests passed!" : "Some tests failed. Check output above.");
  } finally {
    if (serverProc) {
      log("Shutting down server...");
      try {
        process.kill(-serverProc.pid, "SIGTERM");
      } catch {
        serverProc.kill("SIGTERM");
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
