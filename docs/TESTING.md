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

Runs both concurrency and API integration tests. API tests gracefully skip if no dev server is running.

### Watch mode

```bash
pnpm test:watch
```

### Individual suites

```bash
pnpm test:concurrency    # Concurrency tests only (no server needed)
pnpm test:api             # API integration tests (requires running server)
pnpm test:e2e             # E2E browser tests (requires running server)
```

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

## Test Structure

```
tests/
├── setup.ts              # Global setup (Prisma disconnect)
├── helpers.ts            # Shared test utilities
├── concurrency.test.ts   # Concurrency tests (6 tests)
├── api.test.ts           # API integration tests (17 tests)
└── e2e.py                # E2E browser tests (15 tests)
```

### Configuration

`vitest.config.ts` at project root:

```typescript
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    globals: true,
    testTimeout: 30000,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
```

## Test Suites

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

**Authentication:** Tests generate a JWT token using `signToken()` and send it as a cookie.

### E2E Tests (`tests/e2e.py`)

**Purpose:** Validate the full user experience through a real browser.

**Requires:** Running dev server, Python, Playwright with Chromium.

| Group | Tests | Description |
|-------|-------|-------------|
| Login | 3 | Page loads, invalid credentials rejected, successful login redirects to dashboard |
| Dashboard | 2 | Dashboard renders content, sidebar has navigation links |
| Page Navigation | 8 | Products, Customers, Invoices, POS, Accounting, Reports, Purchases, Settings pages load |
| Features | 2 | Theme toggle (dark/light), responsive mobile viewport |

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
