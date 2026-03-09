/**
 * Upload test screenshots, results.json, and vitest output to R2.
 * Run after tests complete: node scripts/upload-test-logs.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "business-system";
const ENDPOINT = process.env.R2_ENDPOINT || `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.log("R2 not configured — skipping test log upload");
  process.exit(0);
}

const client = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

async function upload(localPath, r2Key, contentType) {
  const body = fs.readFileSync(localPath);
  await client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: r2Key,
    Body: body,
    ContentType: contentType,
  }));
  console.log(`  Uploaded: ${r2Key} (${body.length} bytes)`);
}

async function uploadBuffer(buffer, r2Key, contentType) {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: r2Key,
    Body: buffer,
    ContentType: contentType,
  }));
  console.log(`  Uploaded: ${r2Key} (${buffer.length} bytes)`);
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const r2Prefix = `test-logs/${timestamp}`;
  let uploadCount = 0;

  console.log(`\nUploading test logs to R2 under: ${r2Prefix}/\n`);

  // Upload E2E screenshots and results.json
  const screenshotsDir = path.join(__dirname, "..", "tests", "screenshots");
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    for (const file of files) {
      const fullPath = path.join(screenshotsDir, file);
      if (!fs.statSync(fullPath).isFile()) continue;
      const ext = path.extname(file).toLowerCase();
      const contentType =
        ext === ".png" ? "image/png" :
        ext === ".json" ? "application/json" :
        ext === ".txt" ? "text/plain" :
        "application/octet-stream";
      await upload(fullPath, `${r2Prefix}/e2e/${file}`, contentType);
      uploadCount++;
    }
  }

  // Upload vitest output if available
  const vitestLogPath = path.join(__dirname, "..", "tests", "vitest-output.txt");
  if (fs.existsSync(vitestLogPath)) {
    await upload(vitestLogPath, `${r2Prefix}/vitest/output.txt`, "text/plain");
    uploadCount++;
  }

  // Build and upload a manifest for this run
  const manifest = {
    timestamp: new Date().toISOString(),
    runId: timestamp,
    e2e: { screenshots: 0, hasResults: false },
    vitest: { hasOutput: false },
  };

  const resultsPath = path.join(screenshotsDir, "results.json");
  if (fs.existsSync(resultsPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
      manifest.e2e.hasResults = true;
      manifest.e2e.passed = results.passed;
      manifest.e2e.failed = results.failed;
      manifest.e2e.screenshots = (results.screenshots || []).length;
      manifest.e2e.story = results.story || [];
    } catch { /* ignore parse errors */ }
  }

  manifest.vitest.hasOutput = fs.existsSync(vitestLogPath);
  if (manifest.vitest.hasOutput) {
    try {
      const vitestContent = fs.readFileSync(vitestLogPath, "utf-8");
      const passMatch = vitestContent.match(/(\d+)\s+passed/);
      const failMatch = vitestContent.match(/(\d+)\s+failed/);
      manifest.vitest.passed = passMatch ? parseInt(passMatch[1]) : 0;
      manifest.vitest.failed = failMatch ? parseInt(failMatch[1]) : 0;
    } catch { /* ignore */ }
  }

  await uploadBuffer(
    Buffer.from(JSON.stringify(manifest, null, 2)),
    `${r2Prefix}/manifest.json`,
    "application/json"
  );
  uploadCount++;

  console.log(`\nDone! Uploaded ${uploadCount} files under: ${r2Prefix}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
