# Mensajería interna

Reference document for the internal messaging system. User-to-user DMs and group conversations, file attachments, emoji support, RBAC-controlled.

## Overview

The messaging system provides:

- **Direct messages (DMs)** — One-to-one conversations between users in the same company
- **Group conversations** — Multi-participant conversations with optional name
- **File attachments** — Messages can include attachments stored in R2
- **Emoji support** — Message content supports emoji (plain text/Unicode)
- **RBAC** — Access controlled by the `messaging` permission (ADMIN by default)

## Data Model

| Model | Fields |
|-------|--------|
| `Conversation` | `companyId`, `name` (optional), `isGroup`, `createdAt`, `updatedAt` |
| `ConversationParticipant` | `conversationId`, `userId`, `joinedAt`, `lastReadAt`, `isAdmin` |
| `Message` | `conversationId`, `senderId`, `content`, `createdAt`, `editedAt` |
| `MessageAttachment` | `messageId`, `fileName`, `fileSize`, `mimeType`, `r2Key` |

## Conversation Types

| Type | `isGroup` | Participants | Name |
|------|-----------|--------------|------|
| DM | `false` | 2 | Derived from other participant |
| Group | `true` | 2+ | Optional; `name` or auto-generated |

## API Endpoints

### List conversations

```
GET /api/conversations
```

**Headers:** `x-user-id`, `x-company-id` (or `companyId` query for SUPER_ADMIN)

**Response:** Array of conversations with:
- `id`, `name`, `isGroup`, `displayName`, `lastMessage`, `otherParticipants`, `unreadCount`, `updatedAt`

**Errors:** 401 if not authenticated; 403 if no company context.

---

### Create conversation

```
POST /api/conversations
```

**Body:**
```json
{
  "participantIds": ["uuid1", "uuid2"],
  "name": "Grupo de trabajo",
  "isGroup": true
}
```

- For DM: `participantIds` has one user; `isGroup` defaults to `false`
- For group: `participantIds` has one or more; `isGroup: true`; `name` optional

**Response:** 201 with conversation object. If DM already exists, returns 200 with existing conversation.

**Errors:** 400 if `participantIds` empty or invalid; 400 if group has fewer than 2 participants; 400 if users not in company.

---

### Get conversation

```
GET /api/conversations/:id
```

**Response:** Conversation with `id`, `name`, `isGroup`, `displayName`, `participants`, `updatedAt`.

**Errors:** 404 if not found or user not participant.

---

### Update conversation (group only)

```
PUT /api/conversations/:id
```

**Body:**
```json
{
  "name": "Nuevo nombre",
  "addParticipantIds": ["uuid"],
  "removeParticipantIds": ["uuid"]
}
```

**Response:** Updated conversation object.

**Errors:** 400 if not a group; 403 if not group admin.

---

### Leave conversation

```
DELETE /api/conversations/:id
```

**Response:** `{ "ok": true }`

**Errors:** 404 if not found or not participant.

---

### List messages

```
GET /api/conversations/:id/messages
```

**Query parameters:**
- `cursor` — Message ID for pagination
- `limit` — Max messages (default: 50, max: 100)

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "content": "...",
      "createdAt": "ISO8601",
      "editedAt": "ISO8601" | null,
      "sender": { "id", "name", "avatarUrl" },
      "attachments": ["id", "fileName", "fileSize", "mimeType", "url"]
    }
  ],
  "nextCursor": "uuid" | null,
  "hasMore": true
}
```

**Side effect:** Updates `lastReadAt` for the current participant.

**Errors:** 404 if not participant.

---

### Send message

```
POST /api/conversations/:id/messages
```

**Body:**
```json
{
  "content": "Hola 👋"
}
```

**Constraints:** Max 5000 characters.

**Response:** 201 with message object.

**Errors:** 400 if content empty or too long; 404 if not participant.

---

### Edit message

```
PUT /api/conversations/:id/messages/:messageId
```

**Body:** `{ "content": "..." }`

**Response:** Updated message object.

**Errors:** 403 if not the sender; 404 if message not found.

---

### Delete message

```
DELETE /api/conversations/:id/messages/:messageId
```

**Response:** `{ "ok": true }`

**Errors:** 403 if not sender and not ADMIN/SUPER_ADMIN; 404 if message not found.

---

### Get attachment

```
GET /api/conversations/:id/attachments/:attachmentId
```

**Response:** File stream with appropriate `Content-Type` and `Content-Disposition`.

**Errors:** 404 if attachment not found or not participant.

**Note:** Attachments are uploaded when creating messages (implementation may use multipart or separate upload endpoint). The attachment URL is returned in the message object: `/api/conversations/:id/attachments/:attachmentId`.

## Attachments

- Attachments are stored in R2 under a key derived from the message
- `MessageAttachment` stores `fileName`, `fileSize`, `mimeType`, `r2Key`
- Download via `GET /api/conversations/:id/attachments/:attachmentId` (participant-only)

## Floating Chat Widget

In addition to the full messaging page (`/dashboard/mensajes`), a **floating chat widget** is available throughout the dashboard:

- **Chat bubble** — Fixed at the bottom-right corner with unread message badge
- **Quick panel** — Opens a 350x500px panel with conversation list and inline chat
- **Responsive** — Full-screen on mobile devices
- **Toggle** — Click the `MessageSquare` icon in the header navbar to open/close

The widget uses the same API endpoints as the full page. It polls for new messages every 3 seconds when a conversation is open.

### Header Integration

The header navbar shows:
- **Message icon** with unread badge (polls every 15 seconds)
- **Notification bell** with unread notification badge
- Both badges show counts from their respective APIs

## User Avatars

Conversation lists and chat headers display user avatars:
- Loaded from `/api/users/{userId}/avatar`
- Falls back to initial letter if no avatar is set
- Group conversations show a group icon

## RBAC

- **Permission:** `messaging`
- **Default roles:** ADMIN has `messaging`; SUPER_ADMIN has access via `test_runs` and other permissions
- The messaging UI, chat widget, and API routes check `messaging` permission before allowing access
- The chat widget only renders if the user has the `messaging` permission
