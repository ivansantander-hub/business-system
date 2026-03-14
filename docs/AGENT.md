# AURA — AI Business Agent

Reference document for the AI business agent integrated into the messaging system. AURA (Asistente Unificado de Reportes y Análisis) answers natural-language questions about company data using LLM providers with tool-calling capabilities and flexible SQL queries.

## Overview

The agent system provides:

- **Natural-language business queries** — Users ask questions like "How much did we sell today?" and AURA queries the database to answer
- **Multi-provider LLM support** — OpenAI (GPT-4o, GPT-4o-mini, GPT-4.1-mini, GPT-4.1-nano) and Anthropic (Claude Sonnet 4, Claude Haiku 4)
- **Per-company configuration** — Admins enable/disable the agent, choose default models, set API keys, and toggle capabilities
- **Capability-based access control** — Admins decide which data domains (sales, inventory, payroll, etc.) the agent can query
- **Flexible SQL queries** — When predefined tools can't answer a question, AURA generates read-only SQL queries with automatic company scoping
- **Independent conversations** — Each user has a separate 1:1 conversation with AURA; conversations are never shared
- **Audit logging** — All agent interactions (chat, config changes) are recorded in the audit system
- **Rate limiting** — Per-user rate limiting prevents abuse (5-second cooldown between messages)

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
    ├─ Build system prompt (capabilities + DB schema + custom instructions)
    ├─ Send conversation to LLM provider
    │     │
    │     ├─ LLM returns text → save as assistant message
    │     └─ LLM returns tool calls → execute queries → loop back (max 10 rounds)
    │           │
    │           ├─ Predefined tools (Prisma queries)
    │           └─ execute_sql_query (flexible read-only SQL)
    │
    └─ Audit log entry
```

## Data Model

| Model | Key Fields |
|-------|------------|
| `AgentConfig` | `companyId` (unique), `enabled`, `modelProvider`, `modelName`, `openaiApiKey`, `anthropicApiKey`, `capabilities` (JSON), `customPrompt`, `maxTokens` |
| `User.isBot` | Boolean flag identifying the AURA bot user |

The `AgentConfig` model stores per-company configuration. When the agent is first enabled, a special bot user named "AURA" is created with `isBot = true`.

## Capabilities

Each capability maps to a set of read-only database query tools. Admins toggle capabilities on/off per company.

| ID | Label | Tools |
|----|-------|-------|
| `overview` | Resumen General | `get_business_overview` |
| `sales` | Ventas y Facturación | `get_sales_summary`, `get_sales_by_payment_method`, `get_top_selling_products`, `get_invoice_details` |
| `products` | Productos y Precios | `search_products`, `get_product_details`, `get_low_stock_products`, `get_product_stats` |
| `inventory` | Inventario | `get_inventory_status`, `get_inventory_movements` |
| `customers` | Clientes | `list_customers`, `search_customers`, `get_customer_details`, `get_customer_purchase_history` |
| `suppliers` | Proveedores y Compras | `list_suppliers`, `search_suppliers`, `get_purchase_orders` |
| `orders` | Órdenes | `get_active_orders`, `get_order_details`, `get_table_status` |
| `employees` | Empleados | `list_employees`, `search_employees`, `get_employee_details` |
| `payroll` | Nómina | `get_payroll_runs`, `get_payroll_summary` |
| `accounting` | Contabilidad | `get_account_balances`, `get_journal_entries` |
| `memberships` | Membresías | `get_active_memberships`, `get_membership_stats` |
| `cash` | Caja | `get_cash_sessions`, `get_daily_cash_summary` |
| `audit` | Auditoría | `get_recent_audit`, `get_entity_audit_history` |
| `data_query` | Consultas Avanzadas (SQL) | `execute_sql_query` |

All queries are **read-only** and **company-scoped**. The agent cannot modify any data.

### SQL Query Tool

The `execute_sql_query` tool allows AURA to generate custom SQL queries when predefined tools are insufficient. Safety measures:

- Only `SELECT` statements are allowed
- Dangerous keywords (INSERT, UPDATE, DELETE, DROP, etc.) are blocked
- `company_id` filter is automatically injected into every query
- Results are limited to 100 rows maximum
- SQL comments are blocked to prevent injection

This gives AURA the flexibility to answer questions like:
- "How many invoices were issued last month?"
- "What's the last invoice?"
- "Average daily sales this quarter?"
- "Which customer has the most purchases?"

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

**Rate limit:** 5-second cooldown between messages per user. Returns `429` when exceeded.

### Get agent configuration

```
GET /api/agent/config
```

Returns the current agent configuration for the user's company. API keys are masked (`sk-...****xxxx`).

### Update agent configuration

```
PUT /api/agent/config
```

**Requires:** ADMIN or SUPER_ADMIN role.

**Body:** Partial update; only include fields to change.

When enabling the agent for the first time, this endpoint automatically creates the AURA bot user and a 1:1 conversation for it.

### List available models

```
GET /api/agent/models
```

Returns available LLM models from both OpenAI and Anthropic providers.

## API Key Resolution

The system supports two levels of API key management:

1. **Global fallback** — Environment variables `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`)
2. **Per-company override** — Stored in `AgentConfig.openaiApiKey` / `AgentConfig.anthropicApiKey`

Resolution order: company-specific key → global environment variable.

## Orchestration Flow

The orchestrator in `src/lib/agent/index.ts`:

1. Load the latest 30 messages from the conversation
2. Build system prompt from enabled capabilities, DB schema reference, and custom instructions
3. Send message history to the LLM with available tools
4. If the LLM returns tool calls:
   a. Execute each tool (Prisma query or SQL)
   b. Append tool results to the conversation
   c. Send updated history back to the LLM (max 10 iterations)
5. Save the final assistant response as a message
6. Return the response with metadata

## UI Integration

The agent appears as a special contact in the messaging page (`/dashboard/mensajes`):

- **Distinct avatar** — Purple gradient with a Bot icon, always pinned to the top of the conversation list
- **Model selector** — Dropdown in the chat header to override the default model per-conversation
- **Typing indicator** — Animated dots with "AURA está analizando..." while the LLM processes
- **Neon styling** — Special visual treatment to distinguish AI conversations
- **Auto-creation** — The agent conversation is automatically created when the user opens the messages page (if the agent is enabled)

## Configuration UI

Admins manage the agent from `/dashboard/configuracion`:

- **Enable/disable toggle** — Master switch for the entire agent
- **Model selector** — Choose default LLM model
- **API keys** — Optional per-company override keys (masked in UI)
- **Capability toggles** — Checkbox grid to enable/disable data domains (including SQL queries)
- **Custom prompt** — Free-text instructions appended to the system prompt
- **Max tokens** — Control response length
- **Test button** — Quick connectivity check

## RBAC

The `agent` permission controls access to:

- Agent configuration in the settings page
- The agent chat functionality

By default, only `ADMIN` roles have the `agent` permission. It can be customized via the RBAC control panel.

## Security Considerations

- All database queries are **read-only** — the agent cannot create, update, or delete records
- All queries are **company-scoped** — the agent can only access data belonging to the current user's company
- SQL queries are validated (SELECT only, no dangerous keywords, no comments)
- `company_id` is automatically injected into all SQL queries
- API keys are **masked** in GET responses — only the last 4 characters are visible
- Rate limiting prevents abuse (5-second cooldown between messages)
- The orchestrator limits tool-call loops to 10 iterations to prevent infinite loops

## File Structure

```
src/lib/agent/
├── capabilities.ts   — Capability definitions and ID-to-tool mapping
├── index.ts          — Main orchestrator (processMessage)
├── prompts.ts        — System prompt builder with DB schema
├── providers.ts      — LLM provider abstraction (OpenAI, Anthropic)
├── queries.ts        — Read-only Prisma query functions + SQL executor
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
| `CLAUDE_API_KEY` | No | Alternative name for Anthropic key |

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
