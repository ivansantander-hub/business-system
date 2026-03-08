# Concurrency Model

This document explains how SGC handles concurrent operations to protect data integrity in financial transactions, inventory management, and accounting.

## Overview

SGC processes sales, purchases, and cash operations that involve multiple related database writes (invoices, stock updates, journal entries). Without proper concurrency control, parallel requests could cause:

- **Duplicate invoice numbers** — Two sales generating the same number
- **Lost stock updates** — Two sales reading the same stock level, both decrementing from the original value
- **Corrupted balances** — Two journal entries updating the same account balance, one overwriting the other
- **Double-processing** — A purchase being received twice, duplicating inventory

The system prevents all of these through **Serializable transaction isolation** and **Prisma atomic operations**.

## Transaction Isolation

All critical financial operations use PostgreSQL's `Serializable` isolation level via Prisma:

```typescript
await prisma.$transaction(async (tx) => {
  // All reads and writes are serializable
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 15000,
});
```

`Serializable` guarantees that concurrent transactions behave as if they were executed one after another. PostgreSQL achieves this using predicate locks (Serializable Snapshot Isolation). When two transactions conflict, one is aborted with error code `P2034`.

## Retry Strategy

The `createSale` function implements automatic retries for serialization failures:

```
Attempt 1 → P2034/P2002 → wait 50-150ms → Attempt 2 → P2034 → wait 150-300ms → Attempt 3
```

| Parameter | Value |
|-----------|-------|
| Max retries | 3 |
| Backoff | Exponential: `2^attempt * 50ms` |
| Jitter | Random `0-100ms` added to each delay |
| Retryable errors | `P2034` (serialization failure), `P2002` (unique constraint) |
| Timeout per transaction | 15 seconds |

Non-retryable errors (e.g., missing cash session, invalid data) are thrown immediately.

## Protected Operations

### Sales (`src/lib/sale.ts`)

The `createSale` function performs these steps atomically inside a Serializable transaction:

1. Read tax/invoice settings (locked by isolation level)
2. Compute next invoice number from count + last invoice + settings
3. Create `Invoice` + `InvoiceItem` records
4. Update `invoice_next_number` setting
5. Atomic stock decrement per product: `data: { stock: { decrement: quantity } }`
6. Update related order status (if applicable)
7. Atomic cash session total: `data: { salesTotal: { increment: total } }`
8. Create journal entry with atomic account balance updates

**Invoice number uniqueness** is enforced at two levels:
- **Application**: Serializable isolation ensures only one transaction reads/writes the counter at a time
- **Database**: Compound unique constraint `@@unique([companyId, number])` as a safety net

### Purchases (`src/app/api/purchases/[id]/route.ts`)

When a purchase is marked as `RECEIVED`:

1. Find the purchase with guard `status: { not: "RECEIVED" }` — prevents double-receive
2. Atomic stock increment per item: `data: { stock: { increment: quantity } }`
3. Record inventory movements with correct previous/new stock
4. Update purchase status to `RECEIVED`
5. Create journal entry (Inventory debit, Payables credit)

All within a Serializable transaction.

**Cancellation guard**: A purchase that is already `RECEIVED` cannot be cancelled.

### Cash Sessions (`src/app/api/cash/route.ts`)

**Opening a session:**
- Serializable transaction checks for existing OPEN session
- Only creates a new session if none exists
- Prevents two tabs/users from opening duplicate sessions

**Closing a session:**
- Serializable transaction finds the OPEN session
- Calculates expected vs. actual amounts
- Updates status to `CLOSED`
- Creates journal entries for any surplus/deficit

### Accounting (`src/lib/accounting.ts`)

The `createJournalEntry` function:

1. Validates that total debits equal total credits (within 0.01 tolerance)
2. Creates the journal entry and lines
3. Updates each account balance using atomic `{ increment: balanceChange }`

The `increment` operation is translated to `UPDATE accounts SET balance = balance + $1` at the SQL level, which is inherently safe against lost updates even without Serializable isolation.

## Atomic Operations Summary

| Operation | Prisma Pattern | SQL Equivalent |
|-----------|----------------|----------------|
| Stock decrement | `{ stock: { decrement: qty } }` | `SET stock = stock - $1` |
| Stock increment | `{ stock: { increment: qty } }` | `SET stock = stock + $1` |
| Sales total | `{ salesTotal: { increment: total } }` | `SET sales_total = sales_total + $1` |
| Balance update | `{ balance: { increment: change } }` | `SET balance = balance + $1` |

These are preferred over read-then-write patterns because they are atomic at the database level.

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `P2034` | Serialization failure | Retry with backoff |
| `P2002` | Unique constraint violation | Retry (new invoice number) |
| `PURCHASE_NOT_FOUND_OR_ALREADY_RECEIVED` | Double-receive attempt | Return 409 Conflict |
| `ALREADY_OPEN` | Duplicate cash session | Return 400 Bad Request |
| `NO_OPEN_SESSION` | Close without open session | Return 400 Bad Request |
| `NO_CASH_SESSION` | Sale without open cash register | Throw error (UI prevents this) |

## Testing Concurrency

The concurrency test suite (`tests/concurrency.test.ts`) validates these guarantees:

| Test | What it does |
|------|-------------|
| Parallel invoice numbers | Fires 10 `createSale` calls simultaneously; verifies all invoice numbers are unique |
| Parallel stock decrement | 10 parallel sales for the same product; verifies final stock = initial - total sold |
| Parallel purchase receive | 5 purchases received simultaneously; verifies stock = initial + total received |
| Single cash session | 5 simultaneous open requests; verifies exactly 1 session created |
| Accumulate salesTotal | 5 parallel sales; verifies `cashSession.salesTotal` matches sum of all sales |
| Journal balance integrity | Verifies total debits = total credits across all journal entries |

Run with:

```bash
pnpm test:concurrency
```
