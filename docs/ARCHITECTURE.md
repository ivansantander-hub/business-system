# Architecture

This document describes the technical architecture of SGC (Sistema de Gestión Comercial).

## System Overview

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           SGC — Next.js Application                               │
├───────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌───────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Browser   │  │ Store (Jotai) │  │  Middleware  │  │  App Router │  │   API Routes        │ │
│  │   (React)   │◄─┤              │  │  (JWT auth)  │◄─┤  (Pages)    │◄─┤   (REST)             │ │
│  └─────────────┘  └───────────────┘  └─────────────┘  └─────────────┘  └──────────┬──────────┘ │
│         │                 │                 │                   │            │
│         │                 │                 │                   │            │
│  ┌──────▼─────────────────▼─────────────────▼───────────────────▼──────────┐ │
│  │                     Prisma Client (v6)                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  public schema: User, Company, UserCompany, enums                     │  │ │
│  │  │  tenant schema: Category, Product, Order, Invoice, Account, etc.     │  │ │
│  │  └─────────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │   PostgreSQL Database  │
                         │   (public + tenant)    │
                         └────────────────────────┘
```

## Multi-Tenant Architecture

The system uses a **shared database, shared schema** approach with two PostgreSQL schemas:

| Schema | Purpose | Key Models |
|--------|---------|------------|
| **public** | Master/global data | `User`, `Company`, `UserCompany`, enums (`Role`, `CompanyType`) |
| **tenant** | Company-scoped business data | `Category`, `Product`, `Order`, `Invoice`, `Account`, `JournalEntry`, etc. |

All tenant models include a `companyId` foreign key. The active company is determined by:

1. **JWT payload** — `companyId` stored in the signed token
2. **Company switcher** — User can switch companies via `/api/auth/switch-company`
3. **SUPER_ADMIN** — No default company; must pass `companyId` as query param when accessing tenant data

### Data Isolation

- Every API route that touches tenant data calls `requireCompanyId(request)` or `getUserFromHeaders(request)` to obtain the current company context
- Prisma queries filter by `companyId` in the `where` clause
- Users are linked to companies via `UserCompany` (many-to-many with per-company role)

## Authentication Flow

### JWT-Based Auth

- **Library:** `jose` (SignJWT, jwtVerify)
- **Storage:** HTTP-only cookie named `token`
- **Expiration:** 24 hours
- **Payload:** `{ userId, role, name, companyId }`

### Flow Diagram

```
┌──────────┐     POST /api/auth/login      ┌──────────────┐
│  Client  │ ─────────────────────────────► │  Login API   │
│          │  { email, password }           │  bcrypt      │
└────┬─────┘                               └──────┬───────┘
     │                                            │
     │  Set-Cookie: token=<JWT>                   │ signToken()
     │  { user, companies }                       │
     ◄───────────────────────────────────────────┘
     │
     │  Subsequent requests
     │  Cookie: token=<JWT>
     ▼
┌─────────────────────────────────────────────────────────────┐
│  Middleware (src/middleware.ts)                              │
│  1. Skip: /login, /api/auth/login, /_next, favicon           │
│  2. No token → 401 (API) or redirect /login                  │
│  3. verifyToken() fails → redirect /login, delete cookie     │
│  4. Success → set headers: x-user-id, x-user-role,           │
│               x-user-name, x-company-id                      │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  API Routes / Pages                                         │
│  getUserFromHeaders(request) → { userId, role, companyId }   │
│  requireCompanyId(request) → companyId (throws if missing)   │
└─────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)

- **Roles:** `SUPER_ADMIN`, `ADMIN`, `CASHIER`, `WAITER`, `ACCOUNTANT`, `TRAINER`
- **Permissions:** Defined in `src/lib/rbac.ts` as `ROLE_PERMISSIONS` and `COMPANY_TYPE_PERMISSIONS`
- **Company-type filtering:** GYM companies show gym-specific permissions (memberships, checkin, classes, trainers, lockers); RESTAURANT companies show tables, orders
- **Sidebar:** Menu items filtered by `permissions.includes(item.permission)` from `/api/auth/me`

## Database Schema Overview

### Public Schema

- **User** — id, name, email, password, role, isActive
- **Company** — id, name, legalName, nit, type (RESTAURANT | GYM), address, city, taxRegime, etc.
- **UserCompany** — userId, companyId, role (per-company role override)

### Tenant Schema (Key Models)

| Model | Description |
|-------|-------------|
| Category | Product categories (hierarchical via parentId) |
| Product | Items with cost, sale price, tax rate (default 19%), stock |
| Order / OrderItem | Restaurant orders (table, takeout, delivery) |
| Invoice / InvoiceItem | Sales invoices linked to orders |
| CashSession | Cash register sessions (open/close) |
| Account / JournalEntry / JournalLine | PUC chart of accounts, double-entry journal |
| Purchase / PurchaseItem | Supplier purchases |
| Expense | General expenses |
| GymMember, MembershipPlan, DayPass | Gym memberships |
| GymClass, CheckIn, Locker, BodyMeasurement | Gym operations |
| RestaurantTable | Tables for restaurant |

## API Route Patterns

RESTful routes organized by domain:

| Domain | Pattern | Example |
|--------|---------|---------|
| Auth | `/api/auth/*` | login, logout, me, switch-company |
| Companies | `/api/companies`, `/api/companies/[id]` | CRUD companies |
| Products | `/api/products`, `/api/products/[id]` | CRUD products |
| Categories | `/api/categories`, `/api/categories/[id]` | CRUD categories |
| Orders | `/api/orders`, `/api/orders/[id]`, `/api/orders/[id]/items` | Orders + items |
| Invoices | `/api/invoices`, `/api/invoices/[id]` | Invoices |
| Cash | `/api/cash` | Open/close session, list sessions |
| Accounting | `/api/accounting/accounts`, `/api/accounting/journal`, `/api/accounting/expenses` | Chart of accounts, journal, expenses |
| Customers, Suppliers | `/api/customers`, `/api/suppliers` | CRUD |
| Purchases | `/api/purchases`, `/api/purchases/[id]` | Purchases |
| Inventory | `/api/inventory` | Movements |
| Tables | `/api/tables`, `/api/tables/[id]` | Restaurant tables |
| Gym | `/api/gym-members`, `/api/membership-plans`, `/api/checkins`, `/api/day-passes`, `/api/gym-classes`, `/api/body-measurements`, `/api/lockers` | Gym-specific |
| Reports | `/api/reports` | Reports |
| Settings | `/api/settings` | Company settings |
| Users | `/api/users`, `/api/users/[id]` | User management |

All protected routes expect the JWT cookie and use `x-user-id`, `x-company-id` from middleware.

## Accounting Pipeline

The system creates journal entries automatically for key business events:

### 1. Sales → Invoices → Journal Entry

When a sale is completed via `createSale()` in `src/lib/sale.ts`:

- Invoice is created with items
- Journal entry is created with PUC codes:
  - Debit: Cash/Receivables (e.g. 1105, 1305)
  - Credit: Income (41xx), IVA Payable (2408)

### 2. Purchases → Journal Entry

When a purchase is received (`PATCH /api/purchases/[id]`):

- Journal entry: Debit Inventory/Expense, Credit Payables, IVA Credit

### 3. Expenses → Journal Entry

When an expense is created (`POST /api/accounting/expenses`):

- Journal entry: Debit Expense account, Credit Cash

### 4. Cash Session Close → Journal Entry

When a cash session is closed (`POST /api/cash` with `action: "close"`):

- Journal entries for sales summary, cash in/out, differences

### Journal Entry Creation

- Central function: `createJournalEntry(tx, companyId, description, reference, lines)` in `src/lib/accounting.ts`
- Lines use PUC **account codes** (e.g. `1105`, `4135`); accounts are looked up by `code` per company
- Balances are updated on `Account` after each entry
- Manual entries: `POST /api/accounting/journal` with `{ date, description, reference, lines: [{ accountId, debit, credit }] }`

## Company Types and Conditional Features

| Feature | RESTAURANT | GYM |
|---------|------------|-----|
| POS | ✓ | ✓ |
| Tables | ✓ | — |
| Orders (waiter flow) | ✓ | — |
| Invoices | ✓ | ✓ |
| Products, Inventory | ✓ | ✓ |
| Purchases, Suppliers | ✓ | ✓ |
| Accounting | ✓ | ✓ |
| Memberships | — | ✓ |
| Check-in | — | ✓ |
| Day passes (tiqueteras) | — | ✓ |
| Classes | — | ✓ |
| Trainers | — | ✓ |
| Body measurements | — | ✓ |
| Lockers | — | ✓ |

Permissions are filtered by `COMPANY_TYPE_PERMISSIONS` in RBAC so menu items and API access match the company type.

## State Management (Jotai)

The application uses [Jotai](https://jotai.org/) for global state management, replacing the previous React Context approach.

### Atom Structure

Atoms are defined in `src/store/` and exported via barrel:

| Atom | Type | Purpose |
|------|------|---------|
| `themeAtom` | Primitive | Current theme ("light" or "dark") |
| `toggleThemeAtom` | Write-only action | Toggles theme and persists to localStorage |
| `authUserAtom` | Primitive | Current authenticated user object |
| `authLoadingAtom` | Primitive | Auth loading state |
| `fetchAuthAtom` | Write-only async action | Fetches user from `/api/auth/me` |
| `userNameAtom` | Derived read-only | `authUserAtom.name` |
| `userRoleAtom` | Derived read-only | `authUserAtom.role` |
| `companyIdAtom` | Derived read-only | `authUserAtom.companyId` |
| `companyTypeAtom` | Derived read-only | `authUserAtom.companyType` |
| `permissionsAtom` | Derived read-only | `authUserAtom.permissions` |
| `companiesAtom` | Derived read-only | `authUserAtom.companies` |

### Provider

`StoreProvider` (`src/store/Provider.tsx`) wraps the app with JotaiProvider and auto-initializes:
- `ThemeSync` — Syncs `themeAtom` to `<html>` class and localStorage
- `AuthSync` — Calls `fetchAuthAtom` on mount to populate auth state

### Hook Usage

Components use granular hooks to minimize re-renders:
- `useAtomValue(themeAtom)` — Read theme (re-renders only when theme changes)
- `useSetAtom(toggleThemeAtom)` — Toggle theme (never re-renders)
- `useAtomValue(permissionsAtom)` — Read permissions (re-renders only when permissions change)

## Concurrency Model

All financial operations use PostgreSQL `Serializable` transaction isolation to prevent race conditions.

### Sales (`src/lib/sale.ts`)

| Concern | Strategy |
|---------|----------|
| Invoice number uniqueness | Serializable isolation + compound unique `@@unique([companyId, number])` |
| Stock decrement | Prisma atomic `{ decrement: quantity }` inside transaction |
| Cash session salesTotal | Prisma atomic `{ increment: total }` inside transaction |
| Serialization failures | Retry loop (3 attempts) with exponential backoff + jitter |
| Retryable errors | `P2034` (serialization failure), `P2002` (unique constraint) |

```
Sale Request
    │
    ▼
┌─ Serializable Transaction (attempt 1..3) ──────────────────┐
│  1. Read invoice_next_number setting (locked by Serializable)│
│  2. Generate unique invoice number                           │
│  3. Create Invoice + InvoiceItems                           │
│  4. Update invoice_next_number setting                      │
│  5. Atomic stock decrement per product                      │
│  6. Update order status (if orderId)                        │
│  7. Atomic cashSession.salesTotal increment                 │
│  8. Create journal entry (debit/credit with atomic balances)│
└─────────────────────────────────────────────────────────────┘
    │
    ├── Success → return invoice + cashSession
    └── P2034/P2002 → backoff → retry
```

### Purchases (`src/app/api/purchases/[id]/route.ts`)

| Concern | Strategy |
|---------|----------|
| Double-receive prevention | `status: { not: "RECEIVED" }` guard inside Serializable tx |
| Stock increment | Prisma atomic `{ increment: quantity }` |
| Accounting | Journal entry created atomically within same tx |

### Cash Sessions (`src/app/api/cash/route.ts`)

| Concern | Strategy |
|---------|----------|
| Double-open prevention | Check for existing OPEN session inside Serializable tx |
| Double-close prevention | Find OPEN session inside Serializable tx; fails if already closed |
| Difference accounting | Journal entry for surplus/deficit created in same tx |

### Accounting (`src/lib/accounting.ts`)

All account balance updates use Prisma's atomic `{ increment: balanceChange }` to prevent lost-update anomalies. The `createJournalEntry` function validates debit/credit balance before persisting.

## Email & Notification System

The system integrates with **Brevo SMTP** (via `nodemailer`) for transactional emails. Emails are sent as fire-and-forget (non-blocking) after business actions complete.

### Key Components

| Component | Path | Purpose |
|-----------|------|---------|
| Email library | `src/lib/email.ts` | SMTP transport (nodemailer), templates, notification check |
| Notification API | `src/app/api/notifications/` | Company/user/role preference management |
| Password reset | `src/app/api/auth/forgot-password/` | Token-based password recovery |
| Admin panel | `src/app/dashboard/notificaciones/` | UI for managing notification preferences |

### Notification Hierarchy

```
Company Template (enabled?) → User Preference (enabled?) → Send Email
       ↓                            ↓
  Default: true                Default: true
```

Both must be enabled for the email to be sent. See [docs/EMAILS.md](./EMAILS.md) for complete reference.
