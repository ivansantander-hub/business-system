# Architecture

This document describes the technical architecture of SGC (Sistema de Gestión Comercial).

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SGC — Next.js Application                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Browser   │  │  Middleware  │  │  App Router │  │   API Routes        │ │
│  │   (React)   │◄─┤  (JWT auth)  │◄─┤  (Pages)    │◄─┤   (REST)             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┬──────────┘ │
│         │                 │                 │                   │            │
│         │                 │                 │                   │            │
│  ┌──────▼─────────────────▼─────────────────▼───────────────────▼──────────┐ │
│  │                     Prisma Client (v6)                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  public schema: User, Company, UserCompany, enums                     │  │ │
│  │  │  tenant schema: Category, Product, Order, Invoice, Account, etc.     │  │ │
│  │  └─────────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
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
