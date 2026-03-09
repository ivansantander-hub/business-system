# Sucursales (Branches)

Reference document for the branch (sucursal) system. Companies can have multiple branches; users are assigned to branches; business entities are scoped by branch.

## Overview

The branch system provides **full isolation** between branches of the same company. Each branch operates like an independent location with its own:

- **Products and inventory** — Products belong to a branch; stock is tracked per-branch
- **Cash sessions** — Each branch has its own POS cash sessions
- **Tables and orders** — Restaurant tables and orders are branch-specific
- **Invoices and purchases** — Financial documents are tied to a branch
- **Employees** — Users are assigned to one or more branches and must select an active branch to work in

## Branch Context

When a user selects a branch, the selection is **stored in the JWT token** (`branchId` field). All subsequent API requests carry this context via the `x-branch-id` header, set automatically by the middleware.

### Switching Branches

```
POST /api/auth/switch-branch
```

**Body:**
```json
{ "branchId": "uuid" }
```

Pass `null` to clear the branch selection (view all branches). The API verifies the user is assigned to the branch via `UserBranch`.

### Auth/Me Response

The `/api/auth/me` endpoint returns:
- `branchId` — currently selected branch (from JWT)
- `branches` — array of branches the user is assigned to

## Data Model

| Model | Branch field | Isolation level |
|-------|--------------|-----------------|
| `Product` | `branchId` | Per-branch catalog and stock |
| `Invoice` | `branchId` | Per-branch invoices |
| `Order` | `branchId` | Per-branch orders |
| `CashSession` | `branchId` | Per-branch cash sessions |
| `Purchase` | `branchId` | Per-branch purchases |
| `InventoryMovement` | `branchId` | Per-branch stock movements |
| `Expense` | `branchId` | Per-branch expenses |
| `JournalEntry` | `branchId` | Per-branch accounting entries |
| `RestaurantTable` | `branchId` | Per-branch tables |
| `Category` | — | Company-wide (shared) |
| `Customer` | — | Company-wide (shared) |
| `Supplier` | — | Company-wide (shared) |
| `Account` | — | Company-wide (PUC shared) |

## Inter-branch Transfers

Moving products between branches is done through **inventory movements**:
1. Create an OUT movement in the source branch
2. Create an IN movement in the destination branch
3. Both movements reference the same `referenceId` for traceability

## API Endpoints

### List branches

```
GET /api/branches
```

Returns array of branches with `id`, `name`, `address`, `city`, `phone`, `isActive`, `createdAt`, `userCount`.

### Create branch

```
POST /api/branches
```

**Body:**
```json
{
  "name": "Sucursal Norte",
  "address": "Calle 123",
  "city": "Bogotá",
  "phone": "+57 300 123 4567"
}
```

### Manage users

```
GET    /api/branches/:id/users          — List assigned users
POST   /api/branches/:id/users          — Assign users (body: { userIds: [...] })
DELETE /api/branches/:id/users?userId=X  — Remove user
```

## Seed Data

The seed creates two branches for the default company:
- **Sede Principal** — Calle 100 # 15-20, Bogotá
- **Sede Norte** — Calle 170 # 30-40, Bogotá

Admin and Cajero are assigned to both branches. Mesero is assigned to Sede Principal only. All initial products and tables belong to Sede Principal.

## Configuration

Branches are configured from **Sucursales** (`/dashboard/sucursales`). Access requires the `branches` permission (ADMIN by default).
