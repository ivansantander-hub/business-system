# Notificaciones internas

Reference document for the internal notification system. Emails are stored as database notifications; users have read/unread tracking; a notification bell appears in the header and an inbox page is available.

## Overview

The notification system provides:

- **Stored notifications** — Emails sent via the system are persisted in the `Notification` table
- **Per-user delivery** — Each recipient gets a `UserNotification` record linking them to the notification
- **Read/unread tracking** — `UserNotification.readAt` indicates when the user marked it as read
- **Notification bell** — Header displays unread count and links to the inbox
- **Inbox page** — `/dashboard/notificaciones` (or dedicated inbox) lists notifications with pagination and filters

## Data Model

| Model | Fields |
|-------|--------|
| `Notification` | `companyId`, `type` (email/system), `subject`, `bodyHtml`, `bodyText`, `eventType`, `metadata`, `createdAt` |
| `UserNotification` | `userId`, `notificationId`, `readAt`, `createdAt` |

## How Emails Trigger Notifications

When an event email is sent via `sendEventEmail()` or `sendNotification()` in `src/lib/email.ts`:

1. The email is sent via SMTP (Brevo) if enabled
2. If `recipientUserIds` is provided and the email was sent successfully, `storeEmailNotification()` is called
3. `storeEmailNotification()` creates a `Notification` record with `type: "email"` and `eventType` from metadata
4. For each `recipientUserIds`, a `UserNotification` record is created (no email sent for external recipients)

**System notifications** (no email) are created via `createSystemNotification()`:

- Creates a `Notification` with `type: "system"` (or custom type)
- Creates `UserNotification` for each user

## API Endpoints

### List inbox notifications

```
GET /api/notifications/inbox
```

**Query parameters:**
- `page` — Page number (default: 1)
- `limit` — Items per page (default: 20, max: 50)
- `unreadOnly` — `true` to return only unread
- `type` — `email` or `system` to filter by type
- `companyId` — Required for SUPER_ADMIN if not in header

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userNotificationId": "uuid",
      "type": "email",
      "subject": "...",
      "bodyHtml": "...",
      "createdAt": "ISO8601",
      "readAt": "ISO8601" | null
    }
  ],
  "total": 42,
  "unreadCount": 5
}
```

**Errors:** 401 if not authenticated; 403 if no company context.

---

### Unread count

```
GET /api/notifications/inbox/unread-count
```

**Response:** `{ "count": 5 }`

**Errors:** 401 if not authenticated. Returns 0 if no company context.

---

### Mark single notification as read

```
PUT /api/notifications/inbox/:id/read
```

**Response:** `{ "ok": true }`

**Errors:** 401 if not authenticated.

---

### Mark all as read

```
PUT /api/notifications/inbox/read-all
```

**Response:** `{ "ok": true, "count": 3 }`

**Errors:** 401 if not authenticated; 403 if no company context.

## Read/Unread Tracking

- **Unread:** `UserNotification.readAt` is `null`
- **Read:** `UserNotification.readAt` is set to the timestamp when the user marked it read
- Marking is done via `PUT /api/notifications/inbox/:id/read` or `PUT /api/notifications/inbox/read-all`

## UI Integration

- **Header:** Notification bell icon with badge showing unread count; fetches `/api/notifications/inbox/unread-count`
- **Inbox page:** Lists notifications with pagination; filters; mark-as-read actions
