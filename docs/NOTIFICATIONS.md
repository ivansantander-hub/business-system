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

## Browser Push Notifications & Sound Alerts

The system delivers native browser push notifications with distinct audio alerts. These work even when the user is on a different tab or the browser is minimized.

### Architecture

```
┌───────────────┐  polls  ┌──────────────────┐  postMessage  ┌─────────────┐
│ Header.tsx     │───────▶│ useNotification   │─────────────▶│  sw.js       │
│ (polling loop) │        │ Alerts hook       │              │  (Service    │
└───────────────┘        └──────────────────┘              │   Worker)    │
                                │                           └──────┬──────┘
                                │ playSound()                      │
                                ▼                                  ▼
                         HTMLAudioElement              showNotification()
                         /sounds/*.wav                 (native push)
```

### Service Worker (`public/sw.js`)

Registered on first page load via the `useNotificationAlerts` hook. The SW:

- Listens for `SHOW_NOTIFICATION` messages from the client
- Calls `self.registration.showNotification()` (works even when page unfocused)
- Handles `notificationclick` to focus or open the dashboard

### Sound Files

| File | Used for |
|------|----------|
| `public/sounds/notification.wav` | General notifications (two rising tones) |
| `public/sounds/message.wav` | Chat messages (three ascending tones) |

### How It Works

1. The **Header** component polls `/api/notifications/inbox/unread-count` every 30s and `/api/conversations` every 15s.
2. The `useNotificationAlerts` hook compares new counts with previous values.
3. When a count increases:
   - The appropriate WAV sound plays via `HTMLAudioElement`
   - A push notification is sent via the Service Worker (or falls back to `new Notification()`)
4. The Service Worker ensures notifications appear even when the page is not focused or in a background tab.

### Permission Flow

1. On first load, the hook calls `Notification.requestPermission()` once.
2. If the user grants permission, native push notifications are enabled.
3. If denied, only in-page audio alerts play (no OS-level notification).

## UI Integration

- **Header:** Notification bell icon with badge showing unread count; fetches `/api/notifications/inbox/unread-count`
- **Inbox page:** Lists notifications with pagination; filters; mark-as-read actions
