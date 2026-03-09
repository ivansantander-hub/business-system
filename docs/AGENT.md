# Aria — AI Business Agent

Reference document for the AI business agent integrated into the messaging system. Aria answers natural-language questions about company data using LLM providers with tool-calling capabilities.

## Overview

The agent system provides:

- **Natural-language business queries** — Users ask questions like "How much did we sell today?" and Aria queries the database to answer
- **Multi-provider LLM support** — OpenAI (GPT-4o, GPT-4o-mini) and Anthropic (Claude Sonnet, Claude Haiku)
- **Per-company configuration** — Admins enable/disable the agent, choose default models, set API keys, and toggle capabilities
- **Capability-based access control** — Admins decide which data domains (sales, inventory, payroll, etc.) the agent can query
- **Independent conversations** — Each user has a separate 1:1 conversation with Aria; conversations are never shared
- **Audit logging** — All agent interactions (chat, config changes) are recorded in the audit system
- **Rate limiting** — Per-user rate limiting prevents abuse (10 requests per minute)

## Architecture

```
User (Chat UI)
    │
    ▼
POST /api/agent/chat
    │
    ├─ Rate limit check
    ├─ Load AgentConfig for company
    ├─ Resolve API key (company override → global env)
    ├─ Build system prompt (capabilities + custom instructions)
    ├─ Send conversation to LLM provider
    │     │
    │     ├─ LLM returns text → save as assistant message
    │     └─ LLM returns tool calls → execute queries → loop back
    │
    └─ Audit log entry
```

## Data Model

| Model | Key Fields |
|-------|------------|
| `AgentConfig` | `companyId` (unique), `enabled`, `modelProvider`, `modelName`, `openaiApiKey`, `anthropicApiKey`, `capabilities` (JSON), `customPrompt`, `maxTokens` |
| `User.isBot` | Boolean flag identifying bot users (Aria) |

The `AgentConfig` model stores per-company configuration. When the agent is first enabled, a special bot user named "Aria" is created with `isBot = true`.

## Capabilities

Each capability maps to a set of read-only database query tools. Admins toggle capabilities on/off per company.

| ID | Label | Tools |
|----|-------|-------|
| `overview` | Resumen General | `get_business_overview` |
| `sales` | Ventas y Facturación | `get_sales_summary`, `get_sales_by_payment_method`, `get_top_selling_products`, `get_invoice_details` |
| `products` | Productos y Precios | `search_products`, `get_product_details`, `get_low_stock_products`, `get_product_stats` |
| `inventory` | Inventario | `get_inventory_status`, `get_inventory_movements` |
| `customers` | Clientes | `search_customers`, `get_customer_details`, `get_customer_purchase_history`, `list_customers` |
| `suppliers` | Proveedores y Compras | `search_suppliers`, `get_purchase_orders`, `list_suppliers` |
| `orders` | Órdenes | `get_active_orders`, `get_order_details`, `get_table_status` |
| `employees` | Empleados | `search_employees`, `get_employee_details`, `list_employees` |
| `payroll` | Nómina | `get_payroll_runs`, `get_payroll_summary` |
| `accounting` | Contabilidad | `get_account_balances`, `get_journal_entries` |
| `memberships` | Membresías | `get_active_memberships`, `get_membership_stats` |
| `cash` | Caja | `get_cash_sessions`, `get_daily_cash_summary` |
| `audit` | Auditoría | `get_recent_audit`, `get_entity_audit_history` |

All queries are **read-only** and **company-scoped**. The agent cannot modify any data.

## API Endpoints

### Chat with agent

```
POST /api/agent/chat
```

**Body:**

```json
{
  "conversationId": "uuid",
  "modelProvider": "openai",
  "modelName": "gpt-4o"
}
```

`modelProvider` and `modelName` are optional overrides. When omitted, the company's default model is used.

**Response:** `200` with the assistant message, or error.

**Rate limit:** 10 requests per user per minute. Returns `429` when exceeded.

### Get agent configuration

```
GET /api/agent/config
```

Returns the current agent configuration for the user's company. API keys are masked (`sk-...****xxxx`).

**Response:**

```json
{
  "enabled": true,
  "modelProvider": "openai",
  "modelName": "gpt-4o-mini",
  "openaiApiKey": "sk-...****abcd",
  "anthropicApiKey": null,
  "capabilities": { "sales": true, "products": true },
  "customPrompt": null,
  "maxTokens": 4096
}
```

### Update agent configuration

```
PUT /api/agent/config
```

**Requires:** ADMIN or SUPER_ADMIN role.

**Body:** Partial update; only include fields to change.

```json
{
  "enabled": true,
  "modelProvider": "openai",
  "modelName": "gpt-4o-mini",
  "openaiApiKey": "sk-proj-...",
  "capabilities": { "sales": true, "inventory": true },
  "customPrompt": "Always respond in Spanish",
  "maxTokens": 4096
}
```

When enabling the agent for the first time, this endpoint automatically creates the Aria bot user and a 1:1 conversation for it.

### List available models

```
GET /api/agent/models
```

**Response:**

```json
{
  "models": [
    { "provider": "openai", "id": "gpt-4o", "label": "GPT-4o (OpenAI)" },
    { "provider": "openai", "id": "gpt-4o-mini", "label": "GPT-4o Mini (OpenAI)" },
    { "provider": "anthropic", "id": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4 (Anthropic)" },
    { "provider": "anthropic", "id": "claude-haiku-4-20250514", "label": "Claude Haiku 4 (Anthropic)" }
  ]
}
```

## API Key Resolution

The system supports two levels of API key management:

1. **Global fallback** — Environment variables `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`
2. **Per-company override** — Stored encrypted in `AgentConfig.openaiApiKey` / `AgentConfig.anthropicApiKey`

Resolution order: company-specific key → global environment variable. If neither exists, the request fails with a clear error message.

## LLM Provider Abstraction

The `src/lib/agent/providers.ts` module provides a unified interface for both OpenAI and Anthropic:

| Provider | Class | Features |
|----------|-------|----------|
| OpenAI | `OpenAIProvider` | Tool calling via `functions`, streaming-ready |
| Anthropic | `AnthropicProvider` | Tool use via `tool_use` blocks, automatic role mapping |

Both providers implement the `AgentProvider` interface with a `chat()` method that returns tool calls or text content.

## Orchestration Flow

The orchestrator in `src/lib/agent/index.ts` follows this loop:

1. Load the latest user message from the conversation
2. Build system prompt from enabled capabilities and custom instructions
3. Send message history to the LLM
4. If the LLM returns tool calls:
   a. Execute each tool (read-only Prisma query)
   b. Append tool results to the conversation
   c. Send updated history back to the LLM (max 10 iterations)
5. Save the final assistant response as a message in the conversation
6. Return the response

## UI Integration

The agent appears as a special contact in the messaging page (`/dashboard/mensajes`):

- **Distinct avatar** — Purple gradient with a Bot icon, always pinned to the top of the conversation list
- **Model selector** — Dropdown in the chat header to override the default model per-conversation
- **Typing indicator** — Animated dots with "Aria está pensando..." while the LLM processes
- **Auto-creation** — The agent conversation is automatically created when the user opens the messages page (if the agent is enabled)

## Configuration UI

Admins manage the agent from `/dashboard/configuracion`:

- **Enable/disable toggle** — Master switch for the entire agent
- **Model selector** — Choose default LLM model
- **API keys** — Optional per-company override keys (masked in UI)
- **Capability toggles** — Checkbox grid to enable/disable data domains
- **Custom prompt** — Free-text instructions appended to the system prompt
- **Max tokens** — Control response length
- **Test button** — Quick connectivity check

## RBAC

The `agent` permission controls access to:

- Agent configuration in the settings page
- The agent chat functionality

By default, only `ADMIN` roles have the `agent` permission. It can be customized via the RBAC control panel.

## Audit Actions

| Action | Description |
|--------|-------------|
| `agent.chat` | User sent a message to the agent; logs conversation ID and response metadata |
| `agent.chat.error` | Agent chat failed; logs error details |
| `agent.config.update` | Admin updated agent configuration; logs before/after state |
| `agent.config.update.error` | Agent config update failed; logs error details |

## Security Considerations

- All database queries are **read-only** — the agent cannot create, update, or delete records
- All queries are **company-scoped** — the agent can only access data belonging to the current user's company
- API keys stored in the database should be encrypted at rest (depends on database configuration)
- API keys are **masked** in GET responses — only the last 4 characters are visible
- Rate limiting prevents abuse (10 requests/user/minute)
- The orchestrator limits tool-call loops to 10 iterations to prevent infinite loops

## File Structure

```
src/lib/agent/
├── capabilities.ts   — Capability definitions and ID-to-tool mapping
├── index.ts          — Main orchestrator (processMessage)
├── prompts.ts        — System prompt builder
├── providers.ts      — LLM provider abstraction (OpenAI, Anthropic)
├── queries.ts        — Read-only Prisma query functions
└── tools.ts          — Tool JSON schema definitions for LLMs

src/app/api/agent/
├── chat/route.ts     — POST /api/agent/chat
├── config/route.ts   — GET/PUT /api/agent/config
└── models/route.ts   — GET /api/agent/models
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | Global fallback OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Global fallback Anthropic API key |

At least one must be set for the agent to function (unless per-company keys are configured).

## Demo Data

After running `pnpm db:seed` and `pnpm db:seed-data`, the agent has 6 months of transactional data to query across 3 companies:

| Entity | Mi Empresa | FitZone Gym | Mi Tienda Express |
|--------|-----------|-------------|-------------------|
| Customers | 10 | 15 | 15 |
| Suppliers | 5 | 5 | 5 |
| Employees | 8 | 8 | 7 |
| Products | 9 | 12 | 8 |
| Invoices | ~190 | ~190 | ~220 |
| Purchases | ~30 | ~37 | ~28 |
| Orders | ~167 | - | - |
| Cash Sessions | ~36 | ~36 | ~46 |
| Expenses | ~72 | ~67 | ~67 |
| Payroll Runs | 6 | 6 | 6 |
| Memberships | - | ~26 | - |
| Journal Entries | ~24 | ~31 | ~26 |

Date range: September 2025 through March 2026.
