# Auditing & Activity Logging

This document describes the audit logging system that provides full traceability of user actions across the application.

## Architecture

### Singleton Pattern

The logging system uses a **singleton `AuditLogger`** class (`src/lib/audit-logger.ts`) that batches log entries and writes them to the database in bulk. This minimizes the performance impact on API response times.

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│ API Route│────▶│ AuditLogger  │────▶│  PostgreSQL   │
│  Handler │     │ (singleton)  │     │  audit_logs   │
└─────────┘     │  - queue[]   │     └──────────────┘
                │  - flush()   │
┌─────────┐     │  - batch 50  │
│ Frontend │────▶│  - 2s timer  │
│  Logger  │     └──────────────┘
└─────────┘
```

### Key Design Decisions

- **Non-blocking**: All audit calls are fire-and-forget; they never delay API responses.
- **Batched writes**: Entries queue up and flush every 2 seconds or when 50 entries accumulate (whichever comes first).
- **Fail-safe**: If a flush fails, entries are re-queued (up to 500 max to prevent memory leaks).
- **Dual source**: Both backend API routes and frontend actions log to the same table.

## Database Model

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  companyId  String?
  userId     String?
  userName   String?
  action     String          // e.g. "auth.login", "product.create", "page.view"
  entity     String?         // e.g. "Product", "Invoice", "User"
  entityId   String?         // UUID of the affected entity
  details    Json?           // Arbitrary structured data
  ipAddress  String?
  userAgent  String?
  source     String          // "backend" or "frontend"
  level      String          // "info", "warn", "error", "debug"
  duration   Int?            // Milliseconds (for API calls)
  statusCode Int?            // HTTP status code
  path       String?         // URL path
  method     String?         // HTTP method
  createdAt  DateTime
}
```

**Indexes**: `(companyId, createdAt)`, `(userId, createdAt)`, `(action, createdAt)`, `(entity, entityId)`, `(createdAt)`.

## Backend Logging

### Usage in API Routes

```typescript
import { auditApiRequest } from "@/lib/api-audit";

export async function POST(request: Request) {
  // ... handler logic ...
  auditApiRequest(request, "product.create", {
    entity: "Product",
    entityId: product.id,
    statusCode: 201,
  });
  return NextResponse.json(product, { status: 201 });
}
```

### Instrumented Routes

| Route | Actions Logged |
|-------|---------------|
| `POST /api/auth/login` | `auth.login` |
| `POST /api/auth/logout` | `auth.logout` |
| `POST /api/products` | `product.create` |
| `PUT /api/products/:id` | `product.update` |
| `DELETE /api/products/:id` | `product.delete` |
| `POST /api/customers` | `customer.create` |
| `POST /api/invoices` | `invoice.create` |
| `POST /api/purchases` | `purchase.create` |
| `PUT /api/purchases/:id` | `purchase.receive`, `purchase.cancel` |
| `POST /api/cash` | `cash.open`, `cash.close` |
| `POST /api/expenses` | `expense.create` |
| `POST /api/users` | `user.create`, `user.link_company` |
| `PUT /api/rbac` | `rbac.update` |
| `POST /api/rbac` | `rbac.update` (bulk) |
| `PUT /api/profile` | `profile.update` |
| `POST /api/profile/avatar` | `avatar.upload` |
| `DELETE /api/profile/avatar` | `avatar.delete` |
| `POST /api/day-passes` | `daypass.create` |

## Frontend Logging

### Singleton Client Logger

`src/lib/frontend-logger.ts` provides a client-side singleton that:

- Auto-tracks page views via the `usePageTracking` hook
- Captures unhandled errors and promise rejections
- Batches entries (20 per batch, 5s flush interval)
- Sends logs to `POST /api/logs` using `keepalive: true` for reliability

### Page View Tracking

The `usePageTracking` hook in `src/hooks/usePageTracking.ts` is integrated into `DashboardLayout` and automatically logs every page navigation with action `"page.view"`.

### Manual Frontend Logging

```typescript
import { frontendLogger } from "@/lib/frontend-logger";

frontendLogger.info("button.click", { entity: "Sale", details: { buttonId: "checkout" } });
frontendLogger.error("api.failure", { details: { endpoint: "/api/invoices", status: 500 } });
```

## API Endpoints

### `POST /api/logs` — Receive Frontend Logs

Accepts an array of log entries from the frontend. Automatically enriches with `userId`, `companyId`, IP, and user agent from the authenticated session.

### `GET /api/logs` — Query Logs (Admin Only)

Available to `ADMIN` and `SUPER_ADMIN` roles. Supports filtering:

| Parameter | Description |
|-----------|-------------|
| `page` | Page number (default: 1) |
| `limit` | Items per page (max: 100, default: 50) |
| `search` | Full-text search across action, entity, user name, path |
| `level` | Filter by level: `info`, `warn`, `error`, `debug` |
| `source` | Filter by source: `backend`, `frontend` |
| `userId` | Filter by specific user |
| `from` | Start date (YYYY-MM-DD) |
| `to` | End date (YYYY-MM-DD) |
| `action` | Filter by action (partial match) |
| `entity` | Filter by entity type |

### `GET /api/logs/my` — User's Own Activity

Returns the authenticated user's own activity logs, scoped to their current company.

### `GET /api/audit/stats` — Audit Statistics (Admin Only)

Returns aggregated audit statistics: `totalLogs`, `byEntity`, `byUser`, `byAction`, and `recentActivity`. Used by the Centro de Auditoría dashboard.

### `GET /api/audit/timeline` — Entity Timeline (Admin Only)

Returns the Línea de Vida for a given entity. Requires `entity` and `entityId` query parameters. See [Entity Timeline (Línea de Vida)](#entity-timeline-línea-de-vida) above.

### `GET /api/audit/entity-search` — Entity Search (Admin Only)

Searches entities by name across Product, Customer, Invoice, User, and Purchase. Query parameters: `q` (search term, min 2 chars), `type` (entity type or `all`). Returns `{ results: [{ type, id, label, subtitle? }] }`.

### `GET /api/audit/entity-detail` — Entity Detail (Admin Only)

Returns full audit detail for an entity. Query parameters: `entity` (Product, Customer, Invoice, User, Purchase), `entityId` (UUID). Returns `{ entityData, relatedData, auditLogs }`. See [Entity Detail](#entity-detail) above.

## Entity Details in Logs

Audit log entries include structured `details` JSON for key entities. This enables:

- **Human-readable context**: Show entity name, invoice number, total, etc.
- **Clickable navigation**: Links from log entries to the actual entity page

### Details Schema by Action

| Action | Details Fields |
|--------|---------------|
| `invoice.create` | `number`, `total`, `customerName` |
| `product.create` | `name`, `salePrice` |
| `product.update` | `name` |
| `product.delete` | `name` |
| `purchase.create` | `number`, `total` |
| `customer.create` | `name` |
| `user.create` | `name`, `email` |
| `daypass.create` | `customerName`, `entries` |
| `cash.open` | `openingAmount` |
| `cash.close` | `salesTotal`, `closingAmount` |

### Entity URL Resolution (`src/lib/entity-urls.ts`)

The `getEntityUrl(entity, entityId)` function maps entity types to dashboard URLs. Used by the admin log viewer and user activity modals for clickable navigation.

Supported entities: Invoice, Product, Customer, Supplier, Purchase, Expense, User, DayPass, Membership, CashSession, Order.

## Immutable Audit Trail

The audit system captures **before and after state** for key entity changes, providing a complete, tamper-evident history.

### Before/After State Capture

When entities are created, updated, or deleted, the system stores:

- **`beforeState`**: Serialized snapshot of the entity before the change
- **`afterState`**: Serialized snapshot after the change (or `null` for deletions)

This enables full traceability: you can see exactly what changed, when, and by whom. State is captured for Product, Invoice, Purchase, Customer, User, CashSession, DayPass, and other instrumented entities.

### SHA-256 Checksums for Tamper Detection

Each audit log entry receives a **SHA-256 checksum** computed from:

- Action, entity, entityId, userId
- beforeState and afterState
- details
- Timestamp

The checksum is stored with the log and displayed in the admin dashboard. Any modification to the stored record would invalidate the checksum, enabling tamper detection during audits.

## Entity Timeline (Línea de Vida)

The **Línea de Vida** feature (`GET /api/audit/timeline`) provides a chronological view of all audit events for a specific entity.

| Parameter | Description |
|-----------|-------------|
| `entity` | Entity type (e.g. `Product`, `Invoice`, `Customer`) |
| `entityId` | UUID of the entity |
| `page` | Page number (default: 1) |
| `limit` | Items per page (default: 50, max: 100) |

Response includes `events`, `total`, `page`, `limit`, and `totalPages`. Use this to trace the complete lifecycle of any record.

## Admin Audit Dashboard

The **Centro de Auditoría** (`/dashboard/auditoria`) provides a full-featured admin interface with 4 tabs:

- **Resumen (Dashboard) tab**: Statistics (totalLogs, byEntity, byUser, byAction), recent activity
- **Explorador tab**: Searchable log viewer with filters (entity, user, action, date range)
- **Búsqueda tab**: Entity search — search by name across products, customers, invoices, users, purchases
- **Timeline tab**: Entity Línea de Vida — enter entity type and ID to view all events
- **Diff viewer**: Side-by-side before/after comparison for state changes
- **Checksum display**: SHA-256 hash for each entry (tamper detection)

Requires `ADMIN` or `SUPER_ADMIN` role.

## Entity Search

The **Entity Search** feature (Búsqueda tab) allows admins to search across entities by name:

- Search by product name or barcode
- Search by customer name or NIT
- Search by invoice number
- Search by user name or email
- Search by purchase number

Results show entity type, label, and subtitle. Clicking a result opens the **Entity Detail** view with full timeline and related data.

## Entity Detail

The **Entity Detail** view (`GET /api/audit/entity-detail`) provides a comprehensive audit view for any entity:

### Product Lifecycle

For products, the detail view includes:

- **entityData**: Full product record (name, prices, stock, category)
- **relatedData**: Sales (invoices with quantities, customers, totals), purchases (suppliers, quantities), inventory movements, top customers by revenue
- **auditLogs**: Chronological audit trail for the product

### Customer History

For customers, the detail view includes:

- **entityData**: Full customer record
- **relatedData**: Invoices (items, totals, payment methods), memberships, day passes, total spent, invoice count
- **auditLogs**: Chronological audit trail for the customer

### Other Entities

Entity Detail also supports Invoice, User, and Purchase entities with appropriate related data.

## Invoice Cancellation and Reversal Entries

When an invoice is cancelled (`PUT /api/invoices/:id` with `status: "CANCELLED"`), the system:

1. Reverses inventory (restores stock for each item)
2. Creates inventory movements with reason "Anulación factura"
3. Updates the invoice status to `CANCELLED`
4. **Creates reversal journal entries** — a new journal entry with reversed debits/credits to undo the original sale (income, tax, cash/receivables)
5. Decrements `cashSession.salesTotal` if applicable

The reversal entry uses description `Anulación factura {number}` and reference `ANU-{number}`. This ensures accounting integrity: cancelled sales are properly reversed in the books.

## Alignment with HIPAA / 21 CFR Part 11 Principles

The audit system is designed to support compliance with regulatory frameworks that require electronic record integrity and traceability:

| Principle | Implementation |
|-----------|-----------------|
| **Audit trail** | Every significant action is logged with user, timestamp, IP, and entity context |
| **Data integrity** | SHA-256 checksums enable tamper detection; before/after state captures full change history |
| **Attribution** | Each log entry includes `userId`, `userName`, and optional `changeReason` |
| **Non-repudiation** | Immutable logs with checksums support accountability |
| **Electronic signatures** | Change reason can be captured for critical operations (e.g. invoice cancellation) |

This does not constitute certification; implement additional controls (access, retention, backup) as required by your jurisdiction.

## UI

### Admin Log Viewer (`/dashboard/logs`)

Full-featured log viewer accessible via the "Registro de Actividad" sidebar link (requires `logs` permission). Features:

- Search bar with full-text filtering
- Level, source, and date range filters
- Expandable log entries showing full details, IP, user agent, and JSON data
- Pagination
- Color-coded level indicators
- **Entity navigation links**: Clickable badges linking to the affected entity (e.g., invoice, product)
- **Human-readable action labels**: Actions displayed in Spanish alongside the action code

### User Activity from Admin Users Page (`/dashboard/usuarios`)

Admins can click the activity icon on any user row to open a modal showing that user's complete activity history with:

- Entity type badges with navigation links
- Detail previews (entity name, number)
- Expandable entries with IP, path, status code, duration
- Formatted monetary values for price/total fields
- Pagination for long histories

### User Activity in Profile (`/dashboard/perfil`)

The profile page includes a "Mi Actividad Reciente" section showing the user's own recent actions with pagination.

### Test Results Viewer (`/dashboard/test-runs`)

SUPER_ADMIN only. Displays test run history from R2 with:

- Test run listing sorted by date
- Pass/fail summary cards
- Failed test details with error messages
- Screenshot gallery with full-size lightbox viewer
- Test name extracted from screenshot filenames

Requires `test_runs` permission (SUPER_ADMIN default).

## Screenshots & Test Logs

E2E tests automatically capture screenshots for every test case, saved to `tests/screenshots/`. Run all tests and upload with a single command:

```bash
pnpm test:all
```

Or manually:

```bash
pnpm test:e2e
pnpm test:upload-logs
```

Each upload creates a folder in R2 at `test-logs/<timestamp>/` containing:
- `e2e/` — All screenshot PNGs + `results.json`
- `vitest/` — Vitest console output (if available)
- `manifest.json` — Structured metadata about the run
