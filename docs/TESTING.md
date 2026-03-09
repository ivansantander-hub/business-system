# Testing

This document describes the test suite for SGC, including how to run tests, what each suite covers, and how to add new tests.

## Test Stack

| Tool | Purpose | Files |
|------|---------|-------|
| [Vitest](https://vitest.dev/) | Unit and integration tests | `tests/*.test.ts` |
| [Playwright](https://playwright.dev/) (Python) | End-to-end browser tests | `tests/e2e.py` |

## Running Tests

### All Vitest tests

```bash
pnpm test
```

Runs concurrency, email, API, R2 unit, and R2 integration tests. API and R2 integration tests gracefully skip if no dev server is running.

### Watch mode

```bash
pnpm test:watch
```

### Individual suites

```bash
pnpm test:concurrency    # Concurrency tests only (no server needed)
pnpm test:api             # API integration tests (requires running server)
pnpm test:email           # Email template unit tests (no server needed)
pnpm test:r2              # R2 key/PDF unit tests (no server needed)
pnpm test:r2-integration  # R2 integration tests (requires server + R2 credentials)
pnpm test:e2e             # E2E browser tests (requires running server)
```

### All tests (server + Vitest + E2E + R2 upload)

The easiest way to run everything with a single command:

```bash
pnpm test:all
```

This script will:
1. Start the dev server (or detect an already running one)
2. Run all Vitest test suites
3. Run all Python E2E tests
4. Upload screenshots and results to R2
5. Shut down the server when done

### E2E tests (Playwright)

E2E tests require a running dev server and Python with Playwright installed:

```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Run E2E tests
python tests/e2e.py
```

**Prerequisites:**
```bash
pip install playwright
python -m playwright install chromium
```

### Screenshots & Test Log Upload

E2E tests automatically capture screenshots for every test in `tests/screenshots/`. After running tests, upload screenshots and results to R2:

```bash
pnpm test:upload-logs
```

This uploads all screenshots, `results.json`, and a `manifest.json` to R2 under `test-logs/<timestamp>/`.

### Test Results Viewer

SUPER_ADMIN users can view test run history, screenshots, and results from the admin panel at `/dashboard/test-runs`. This page fetches data from R2 and displays:
- Test run listing sorted by date
- Pass/fail summary
- Failed test details
- Full-size screenshot viewer with lightbox

### Manual Test Runner

SUPER_ADMIN users can **run tests directly from the UI** at `/dashboard/test-runs`:

1. Click **Ejecutar tests** to start a test run
2. The UI polls `GET /api/test-runs/execute` for live output
3. When complete, results (pass/fail, exit code) are shown
4. The run uses `scripts/run-all-tests.js` (Vitest + E2E + R2 upload)

**API endpoints:**
- `POST /api/test-runs/execute` — Start test execution (SUPER_ADMIN only; returns 409 if already running)
- `GET /api/test-runs/execute` — Get current execution status (`running`, `output`, `exitCode`, `completed`)

Only one execution can run at a time. The output stream is captured and returned on each poll.

## Test Structure

```
tests/
├── setup.ts                 # Global setup (Prisma disconnect)
├── helpers.ts               # Shared test utilities
├── email.test.ts            # Email template unit tests (17 tests)
├── concurrency.test.ts      # Concurrency tests (6 tests)
├── api.test.ts              # API integration tests (42 tests)
├── r2-pdf.test.ts           # R2 key generation and PDF generation tests (9 tests)
├── r2-integration.test.ts   # R2 live integration tests (8 tests)
├── e2e.py                   # E2E browser tests with screenshots (29 tests)
└── screenshots/             # Auto-generated E2E test screenshots
```

### Configuration

`vitest.config.ts` at project root:

```typescript
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    globals: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
```

## Test Suites Summary

| Suite | Tests | Server Required | R2 Required | Description |
|-------|-------|-----------------|-------------|-------------|
| `concurrency.test.ts` | 6 | No | No | Parallel database operation integrity |
| `email.test.ts` | 17 | No | No | Email templates and event constants |
| `api.test.ts` | 42 | Yes | No | REST API endpoint validation |
| `r2-pdf.test.ts` | 9 | No | No | R2 key generation and PDF creation |
| `r2-integration.test.ts` | 8 | Yes | Yes | Live R2 upload/download/delete + API flows |
| `e2e.py` | 29 | Yes | No | Full browser-based user experience with screenshots |
| **Total** | **111** | | | |

## Test Suites Detail

### Concurrency Tests (`tests/concurrency.test.ts`)

**Purpose:** Validate that parallel database operations maintain data integrity.

**Requires:** Database connection (no server needed).

| Test | Description |
|------|-------------|
| Parallel invoice numbers | 10 simultaneous `createSale` calls — all invoice numbers must be unique |
| Parallel stock decrement | 10 parallel sales for same product — final stock matches expected value |
| Parallel purchase receive | 5 purchases received simultaneously — stock increments are correct |
| Single cash session | 5 simultaneous open requests — exactly 1 session created |
| SalesTotal accumulation | 5 parallel sales — `cashSession.salesTotal` matches sum |
| Journal balance integrity | Total debits = total credits across all journal entries |

### API Integration Tests (`tests/api.test.ts`)

**Purpose:** Validate REST API endpoints with real HTTP requests.

**Requires:** Running dev server (set `TEST_BASE_URL` env var, defaults to `http://localhost:3000`). Tests skip gracefully if server is unavailable.

| Suite | Tests | Description |
|-------|-------|-------------|
| Auth | 3 | Login with valid/invalid credentials, token validation via `/api/auth/me` |
| Products | 3 | Create, list, update products |
| Customers | 2 | Create, list customers |
| Cash Session | 4 | Open, query current, close, double-close prevention |
| Invoices | 1 | List invoices |
| Purchases | 3 | Create purchase, receive (updates stock), double-receive returns 409 |
| Reports | 1 | Dashboard report endpoint |
| Forgot Password | 2 | Forgot password always 200, reset rejects invalid token |
| Notifications | 4 | List event templates, toggle notification, user/role preferences |
| RBAC | 4 | List role configs, toggle permission, bulk-update, reject invalid role |
| Profile | 3 | Get profile, update name, reject wrong password |
| Invoice PDF | 1 | Returns 404 for non-existent invoice |
| Purchase PDF | 1 | Returns 404 for non-existent purchase |
| Audit | 4 | Audit stats, entity timeline, entity-search, entity-detail |
| Invoice Export | 1 | XML export (create sale, then request XML) |
| Company Config | 2 | retentionYears, DIAN fields, electronicInvoicingEnabled |
| Accounting | 3 | Balance sheet, income statement, trial balance |

**Authentication:** Tests generate a JWT token using `signToken()` and send it as a cookie.

### Email Tests (`tests/email.test.ts`)

Unit tests for the email/notification system. These do not require a running server or SMTP credentials.

| Test Group | Tests | Description |
|------------|-------|-------------|
| Email Event Constants | 2 | Validates all event types and labels are defined |
| Event Meta / Recipient Types | 4 | Validates external/internal/system classification |
| formatCurrency | 2 | COP currency formatting |
| Email Template Functions | 8 | Validates each template function generates correct params |

### R2 & PDF Unit Tests (`tests/r2-pdf.test.ts`)

Unit tests for the R2 storage layer and PDF generation. No server or R2 credentials needed.

| Test Group | Tests | Description |
|------------|-------|-------------|
| R2 Key Generation | 5 | Validates key paths for invoices, purchases, and avatars |
| R2 Configuration | 1 | Validates `isR2Configured()` returns a boolean |
| PDF Generation | 3 | Generates sale invoice, purchase order, and empty-item PDFs — validates PDF magic bytes |

### R2 Integration Tests (`tests/r2-integration.test.ts`)

**Purpose:** Validate live Cloudflare R2 integration end-to-end, including actual uploads, downloads, and deletions against the real R2 bucket, plus API-level PDF and avatar flows.

**Requires:** Running dev server AND valid R2 credentials in `.env`. Tests skip gracefully if either is unavailable.

| Test Group | Tests | Description |
|------------|-------|-------------|
| R2 Direct Client | 2 | Upload/download/delete text file; upload/download/verify PDF binary |
| Invoice PDF Flow | 2 | Create sale via API → wait for PDF generation → retrieve via `/api/invoices/:id/pdf`; verify R2 caching |
| Purchase PDF Flow | 1 | Create purchase via API → wait for PDF generation → retrieve via `/api/purchases/:id/pdf` |
| Avatar Upload Flow | 1 | Upload avatar PNG → retrieve → delete → verify 404 |
| Profile Integration | 2 | `/api/auth/me` includes `avatarUrl`; `/api/profile` includes `avatarUrl` |

### E2E Tests (`tests/e2e.py`)

**Purpose:** Validate the full user experience through a real browser.

**Requires:** Running dev server, Python, Playwright with Chromium.

| Group | Tests | Description |
|-------|-------|-------------|
| Login | 3 | Page loads, invalid credentials rejected, successful login redirects to dashboard |
| Dashboard | 2 | Dashboard renders content, sidebar has navigation links |
| Page Navigation | 8 | Products, Customers, Invoices, POS, Accounting, Reports, Purchases, Settings pages load |
| Features | 7 | Theme toggle, responsive mobile viewport, forgot password, notifications, RBAC, profile pages, PDF 404 |
| R2 & PDF Integration | 4 | Avatar file input present, invoice PDF link in detail, purchase PDF via API, actual invoice PDF download |
| Logs & Audit | 5 | Logs page, profile activity, auditoría page, facturación electrónica page, audit entity search |

## Test Helpers (`tests/helpers.ts`)

Shared utilities for setting up test data:

| Function | Purpose |
|----------|---------|
| `getOrCreateTestCompany()` | Creates or finds a test company with required PUC accounts |
| `getOrCreateTestUser(companyId)` | Creates or finds a test user assigned to the company |
| `createTestProduct(companyId, stock)` | Creates a product with specified initial stock |
| `openCashSession(userId, companyId)` | Opens a cash session (or returns existing open one) |
| `cleanupTestData(companyId)` | Deletes all test data for a company (journal lines, invoices, inventory, etc.) |

## Writing New Tests

### Adding a Vitest test

1. Create a file in `tests/` with the `.test.ts` extension
2. Import helpers from `./helpers`
3. Use `beforeAll` to set up test data, `afterAll` to clean up
4. For API tests, use the `requireServer(ctx)` pattern to skip when no server is available:

```typescript
it("should do something", async (ctx) => {
  requireServer(ctx);
  const res = await apiRequest("/api/endpoint");
  expect(res.status).toBe(200);
});
```

### Adding an E2E test

1. Add a new function in `tests/e2e.py` following the pattern:

```python
def test_my_feature(page):
    page.goto(f"{BASE_URL}/dashboard/my-page")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    body_text = page.text_content("body") or ""
    report("My feature works", "expected text" in body_text)
```

2. Call it from `main()` in the appropriate group.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | PostgreSQL connection string for test database |
| `TEST_BASE_URL` | `http://localhost:3000` | Base URL for API and E2E tests |
| `R2_ACCESS_KEY_ID` | — | Required for R2 integration tests |
| `R2_SECRET_ACCESS_KEY` | — | Required for R2 integration tests |
| `R2_ACCOUNT_ID` | — | Required for R2 integration tests |
| `R2_BUCKET_NAME` | `business-system` | R2 bucket name |
| `R2_ENDPOINT` | auto-generated | S3-compatible endpoint for R2 |
