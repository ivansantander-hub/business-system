# Email & Notification System

Reference documentation for the transactional email and notification preference system.

## Overview

The system uses [Brevo](https://www.brevo.com/) (formerly Sendinblue) to send transactional emails triggered by business actions. Notifications are configurable at three levels: **company**, **role**, and **user**.

## Architecture

```
Business Action (sale, purchase, membership...)
       │
       ▼
  sendNotification(companyId, eventType, params, userId?)
       │
       ├── isNotificationEnabled(companyId, eventType, userId?)
       │     ├── Check NotificationTemplate (company level)
       │     └── Check UserNotificationPreference (user level)
       │
       └── sendEmail(params)  →  Brevo SMTP (nodemailer)
```

All email sends are **fire-and-forget** (`.catch(() => {})`) to avoid blocking the main business transaction.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SMTP_HOST` | SMTP server hostname (default: `smtp-relay.brevo.com`) | Yes |
| `SMTP_PORT` | SMTP server port (default: `587`) | Yes |
| `SMTP_USER` | SMTP login (Brevo account email) | Yes |
| `SMTP_PASS` | SMTP password (Brevo SMTP key) | Yes |
| `SMTP_FROM_EMAIL` | Verified sender email address | Yes |
| `SMTP_FROM_NAME` | Display name for the sender | No (defaults to "SGC") |
| `NEXT_PUBLIC_APP_URL` | Base URL for links in emails (e.g., password reset) | Yes |

## Email Events

Each event has a **recipient type** that determines who receives the email:

- **External** — Sent to customers or suppliers (configurable per company)
- **Internal** — Sent to employees/staff who performed the action
- **System** — Automatic, always sent (e.g., password recovery)

| Event Type | Constant | Trigger | Recipient | Type |
|------------|----------|---------|-----------|------|
| `user_created` | `EMAIL_EVENTS.USER_CREATED` | New user created | The new user | Internal |
| `password_reset` | `EMAIL_EVENTS.PASSWORD_RESET` | Forgot password request | The user | System |
| `sale_completed` | `EMAIL_EVENTS.SALE_COMPLETED` | Invoice created via POS | The customer | External |
| `invoice_generated` | `EMAIL_EVENTS.INVOICE_GENERATED` | Reserved for future use | The customer | External |
| `purchase_created` | `EMAIL_EVENTS.PURCHASE_CREATED` | New purchase order | The user who created it | Internal |
| `purchase_received` | `EMAIL_EVENTS.PURCHASE_RECEIVED` | Purchase marked as received | The user who received it | Internal |
| `membership_created` | `EMAIL_EVENTS.MEMBERSHIP_CREATED` | New membership sold | The customer/member | External |
| `daypass_created` | `EMAIL_EVENTS.DAYPASS_CREATED` | New day pass sold | The customer/member | External |
| `cash_session_closed` | `EMAIL_EVENTS.CASH_SESSION_CLOSED` | Cash session closed | The cashier | Internal |
| `order_paid` | `EMAIL_EVENTS.ORDER_PAID` | Reserved for future use | The customer | External |

The notification admin panel groups events by recipient type, so the administrator can clearly see which notifications reach customers and suppliers.

## Notification Preferences

### Three-Level Hierarchy

1. **Company level** (`NotificationTemplate`): Toggles an event type on/off for the entire company
2. **User level** (`UserNotificationPreference`): Overrides for a specific user
3. **Role level** (via API): Batch-sets user preferences for all users with a given role

An email is sent only if **both** the company template AND the user preference are enabled. If no record exists, the default is `enabled: true`.

### Database Models

```prisma
model NotificationTemplate {
  id        String  @id @default(uuid())
  companyId String
  eventType String
  enabled   Boolean @default(true)
  subject   String?
  bodyHtml  String?
  @@unique([companyId, eventType])
}

model UserNotificationPreference {
  id        String  @id @default(uuid())
  userId    String
  companyId String
  eventType String
  enabled   Boolean @default(true)
  @@unique([userId, companyId, eventType])
}
```

## API Routes

### Company Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List all event types with enabled status |
| PUT | `/api/notifications` | Toggle `{ eventType, enabled }` |

### User Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/users` | List user preferences (optional `?userId=xxx`) |
| PUT | `/api/notifications/users` | Set `{ userId, eventType, enabled }` |

### Role Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/roles` | List preferences grouped by role |
| PUT | `/api/notifications/roles` | Set `{ role, eventType, enabled }` for all users with that role |

## Password Recovery

### Flow

1. User clicks "¿Olvidaste tu contraseña?" on the login page
2. User enters their email → POST `/api/auth/forgot-password`
3. System generates a UUID token, stores in `PasswordResetToken` (expires in 1 hour)
4. Email sent with link: `{APP_URL}/reset-password?token={token}`
5. User clicks link → `/reset-password` page
6. User enters new password → POST `/api/auth/reset-password`
7. Token validated, password updated, token marked as used

### Security

- The forgot password endpoint always returns 200 (does not reveal if email exists)
- Tokens expire after 1 hour
- Tokens can only be used once (`usedAt` timestamp)
- Passwords are hashed with bcryptjs (salt rounds: 10)

## Email Templates

All templates are generated as inline HTML (no external CSS) for maximum email client compatibility. The shared wrapper function `wrapHtml()` provides:

- A gradient header with the company name
- A white content card with rounded corners
- An automatic footer disclaimer
- Responsive layout (max-width 600px)

### Template Functions

| Function | Parameters | Returns |
|----------|-----------|---------|
| `emailUserCreated` | userName, email, tempPassword, companyName | `SendEmailParams` |
| `emailPasswordReset` | userName, email, resetUrl | `SendEmailParams` |
| `emailSaleCompleted` | email, name, invoiceNumber, total, items[], companyName | `SendEmailParams` |
| `emailPurchaseCreated` | email, name, purchaseNumber, supplierName, total, companyName | `SendEmailParams` |
| `emailPurchaseReceived` | email, name, purchaseNumber, total, companyName | `SendEmailParams` |
| `emailMembershipCreated` | email, name, planName, startDate, endDate, total, companyName | `SendEmailParams` |
| `emailDayPassCreated` | email, name, totalEntries, total, companyName | `SendEmailParams` |
| `emailCashSessionClosed` | email, name, salesTotal, opening, closing, difference, companyName | `SendEmailParams` |

## Admin Panel

The notification admin panel is available at `/dashboard/notificaciones` for users with the `notifications` permission (ADMIN role). It provides three views:

- **Empresa**: Toggle notification types on/off for the entire company
- **Roles**: Batch-manage preferences for all users with a specific role
- **Usuarios**: View and override individual user preferences

## Testing

```bash
pnpm test:email    # Unit tests for email templates and constants
pnpm test:api      # Integration tests including notification API routes
```

### Test Coverage

- 13 unit tests for email template functions and constants
- 4 API integration tests for notification CRUD operations
- 2 API tests for forgot/reset password flow
- 2 E2E tests for forgot password link and notifications page

## Adding a New Email Event

1. Add the event to `EMAIL_EVENTS` in `src/lib/email.ts`
2. Add a label in `EVENT_LABELS`
3. Create a template function (e.g., `emailMyNewEvent(...)`)
4. Call `sendNotification()` in the relevant API route
5. Write a unit test in `tests/email.test.ts`
6. Update this document
