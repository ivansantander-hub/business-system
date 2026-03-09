# Risk Assessment — SGC (Sistema de Gestión Comercial)

> **Document type:** Reference  
> **Last updated:** 2026-03-09  
> **Target audience:** Development team and system administrators  

This document catalogs the known security, functional, and technical risks present in the current system. Each risk is categorized by severity (Critical, High, Medium, Low) and includes a recommended mitigation.

---

## 1. Security Risks

### 1.1 JWT Secret Fallback to Hardcoded Default

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Location** | `src/lib/auth.ts:4-6` |
| **Description** | The JWT signing key falls back to `"default-secret-change-me"` when `JWT_SECRET` is not set in the environment. If a deployment omits this variable, all tokens are signed with a publicly known secret, allowing any attacker to forge valid JWTs. |
| **Mitigation** | Remove the fallback. Throw an error at startup if `JWT_SECRET` is missing. Use a cryptographically random secret of at least 256 bits. |

### 1.2 No Rate Limiting on Authentication Endpoints

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Location** | `src/app/api/auth/login/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts` |
| **Description** | Authentication endpoints accept unlimited requests. An attacker can perform brute-force password attacks or overwhelm the forgot-password flow to flood inboxes. |
| **Mitigation** | Implement rate limiting per IP (e.g., 5 login attempts per minute). Consider using middleware-level rate limiting with a library such as `rate-limiter-flexible` or an edge solution like Cloudflare WAF rules. |

### 1.3 ~~RBAC API Lacks Role Authorization Check~~ (MITIGATED)

| Field | Value |
|---|---|
| **Severity** | ~~High~~ Mitigated |
| **Location** | `src/app/api/rbac/route.ts` — `PUT` and `POST` handlers |
| **Description** | The RBAC endpoints that modify role permissions previously only validated company context. Now both `PUT` and `POST` handlers verify the requesting user's role is `ADMIN` or `SUPER_ADMIN` before allowing changes. |
| **Status** | Fixed on 2026-03-07. Role check added via `getUserFromHeaders()` at the top of both mutation handlers. |

### 1.4 No Input Validation Library

| Field | Value |
|---|---|
| **Severity** | High |
| **Location** | All API route handlers |
| **Description** | Request bodies are consumed via `request.json()` and accessed directly without schema validation. Missing or malformed fields cause unhandled runtime errors or pass unexpected data to Prisma queries. |
| **Mitigation** | Adopt a schema validation library (Zod is recommended for TypeScript). Validate all incoming request bodies at the API boundary before any business logic executes. |

### 1.5 No CSRF Protection

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | All state-changing API routes |
| **Description** | The application uses `httpOnly` cookies for authentication but has no CSRF token mechanism. While `sameSite: "lax"` mitigates some cross-origin POST scenarios, it does not protect against all CSRF vectors, particularly on same-site subdomains. |
| **Mitigation** | Implement a double-submit cookie pattern or use the `Origin`/`Referer` header validation. Alternatively, adopt token-based auth (Bearer) for API calls, which is inherently CSRF-immune. |

### 1.6 No Security Headers

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `next.config.ts`, `src/middleware.ts` |
| **Description** | The application does not set security headers such as `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy`. This leaves the application vulnerable to clickjacking, MIME-sniffing attacks, and content injection. |
| **Mitigation** | Add a `headers()` configuration in `next.config.ts` or set headers in middleware. At minimum: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a basic CSP. |

### 1.7 No XSS Sanitization for Chat Messages

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `src/app/api/conversations/[id]/messages/route.ts`, chat rendering components |
| **Description** | Chat message content is stored and rendered without sanitization. While React escapes JSX by default, any use of `dangerouslySetInnerHTML` or rich-text rendering could enable stored XSS attacks. |
| **Mitigation** | Sanitize message content server-side on write using a library like `DOMPurify` or `sanitize-html`. Never render user-provided HTML without sanitization. |

### 1.8 User Identity Injected via Headers

| Field | Value |
|---|---|
| **Severity** | High |
| **Location** | `src/lib/auth.ts:40-53`, `src/middleware.ts:39-47` |
| **Description** | Middleware extracts JWT claims and sets them as `x-user-id`, `x-user-role`, etc., on the response headers. API route handlers then read these headers via `getUserFromHeaders()`. If the application is deployed behind a reverse proxy that does not strip incoming `x-user-*` headers, an attacker could inject arbitrary identity claims by sending custom headers directly to the origin. |
| **Mitigation** | Ensure the deployment architecture strips all `x-user-*` and `x-company-id` headers from incoming requests before they reach the Next.js middleware. Alternatively, use a request-scoped context (e.g., `AsyncLocalStorage`) instead of headers for identity propagation. |

### 1.9 CORS Not Explicitly Configured

| Field | Value |
|---|---|
| **Severity** | Low |
| **Location** | `next.config.ts` |
| **Description** | No explicit CORS policy is configured. Next.js defaults to same-origin for API routes, but if the app needs to support cross-origin clients (mobile apps, external integrations), the lack of an explicit policy could result in either over-permissive or unexpectedly restrictive behavior. |
| **Mitigation** | Define an explicit CORS policy in `next.config.ts` headers or middleware, specifying allowed origins, methods, and headers. |

### 1.10 File Upload Validation Based on MIME Only

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | File upload API routes |
| **Description** | File uploads validate the MIME type from the `Content-Type` header, which is client-controlled and trivially spoofed. Malicious files (e.g., executable scripts disguised as images) can bypass this check. |
| **Mitigation** | Validate file content using magic bytes (file signatures). Use a library like `file-type` to detect the actual file type from the binary content. Restrict allowed extensions and store files with randomized names. |

### 1.11 No `.env.example` or Environment Variable Documentation

| Field | Value |
|---|---|
| **Severity** | Low |
| **Location** | Project root |
| **Description** | There is no `.env.example` file documenting required environment variables. Developers may miss critical variables like `JWT_SECRET` or `DATABASE_URL`, leading to insecure defaults or runtime errors. |
| **Mitigation** | Create a `.env.example` file listing all required and optional environment variables with safe placeholder values and descriptions. |

---

## 2. Functional Risks

### 2.1 User Creation Failed Across Companies (Resolved)

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Status** | **Resolved** as of 2026-03-07 |
| **Location** | `src/app/api/users/route.ts` — `POST` handler |
| **Description** | When an admin attempted to add an existing user (by email) from another company, the system threw a unique constraint violation instead of linking the existing user to the new company. |
| **Resolution** | The POST handler now checks for existing users by email and creates a `UserCompany` link instead of failing. |

### 2.2 Middleware Deprecation in Next.js 16

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `src/middleware.ts` |
| **Description** | Next.js 16 deprecates the `middleware.ts` convention in favor of `proxy.ts`. While the current middleware still functions, a future major version may remove support entirely, breaking authentication and routing logic. |
| **Mitigation** | Plan migration to `proxy.ts` once it supports JSON responses from API routes. Monitor Next.js release notes for the deprecation timeline. |

### 2.3 No Real-Time Updates (Polling Only)

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `src/components/organisms/Header.tsx` |
| **Description** | Notifications poll every 30 seconds and messages every 15 seconds. Users may see stale data for up to 30 seconds. In high-traffic scenarios, polling creates unnecessary server load and increases latency for time-sensitive events like orders and kitchen updates. |
| **Mitigation** | Implement WebSocket or Server-Sent Events (SSE) for real-time notification delivery. This reduces server load and provides instant updates. |

### 2.4 Turbopack Cache Corruption

| Field | Value |
|---|---|
| **Severity** | Low |
| **Location** | `.next/` build cache |
| **Description** | The Turbopack build cache can become corrupted (observed during development), causing pages to hang indefinitely during server-side rendering. Recovery requires manually deleting the `.next` directory and restarting. |
| **Mitigation** | Document the recovery procedure in developer onboarding. Consider adding a script (`pnpm clean`) that automates cache cleanup. Monitor for upstream fixes in Turbopack. |

### 2.5 Generic Error Handling Masks Root Causes

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | Multiple API routes (e.g., `catch` blocks) |
| **Description** | Many API routes use bare `catch` blocks that return generic error messages (e.g., "Error al crear usuario"). The actual error type, Prisma error code, or validation failure is discarded, making debugging and user feedback difficult. |
| **Mitigation** | Differentiate error types in catch blocks. Return specific messages for known errors (Prisma P2002 for unique violations, P2025 for not found, etc.) and log the full error details server-side. |

### 2.6 No Pagination on Several List Endpoints

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `src/app/api/users/route.ts` GET (SUPER_ADMIN path), other list endpoints |
| **Description** | Several list endpoints return all records without pagination. As data grows, response times increase and memory usage spikes, potentially causing timeouts or out-of-memory errors. |
| **Mitigation** | Implement cursor-based or offset pagination with configurable page sizes on all list endpoints. |

---

## 3. Technical Risks

### 3.1 No WebSocket/SSE Infrastructure

| Field | Value |
|---|---|
| **Severity** | High |
| **Location** | System-wide |
| **Description** | The application relies entirely on HTTP polling for real-time features. Notification polling (30s), message polling (15s), and active chat polling (3s) create a cumulative load of ~30 requests/minute per active user. With 100 concurrent users, this amounts to ~3,000 requests/minute just for polling. |
| **Mitigation** | Implement a WebSocket or SSE gateway. Consider using a managed solution (Pusher, Ably) or self-hosted (Socket.io with Redis adapter) to push events to clients. |

### 3.2 Single Prisma Client Instance — Connection Pool Limits

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `src/lib/prisma.ts` |
| **Description** | A single Prisma client instance is shared across all requests. Under high concurrency, the default connection pool size (usually 10 connections) can become exhausted, causing queries to queue and eventually time out. |
| **Mitigation** | Configure the Prisma connection pool size explicitly via `DATABASE_URL` parameters (`?connection_limit=20&pool_timeout=10`). Monitor connection usage in production. Consider using PgBouncer or a similar connection pooler for serverless deployments. |

### 3.3 No Database Migration Versioning Strategy

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `prisma/` directory |
| **Description** | While Prisma Migrate handles schema changes, there is no documented strategy for migration versioning, rollback procedures, or data migration patterns. This increases the risk of data loss during schema changes in production. |
| **Mitigation** | Document the migration workflow (create, apply, rollback). Establish a policy for destructive migrations (column drops, type changes). Test migrations against a production-like dataset before applying. |

### 3.4 No Automated CI/CD Pipeline

| Field | Value |
|---|---|
| **Severity** | High |
| **Location** | Project infrastructure |
| **Description** | There is no continuous integration or continuous deployment pipeline. Code changes are not automatically tested, linted, or deployed. This increases the risk of regressions, inconsistent builds, and human error during deployments. |
| **Mitigation** | Set up a CI/CD pipeline (GitHub Actions, GitLab CI, etc.) that runs linting, type checking, unit tests, and integration tests on every push. Automate staging and production deployments with rollback capabilities. |

### 3.5 No Load Testing or Performance Benchmarks

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | Project infrastructure |
| **Description** | There are no load tests, stress tests, or documented performance benchmarks. The system's behavior under concurrent load is unknown, making it impossible to predict capacity limits or identify bottlenecks before they affect users. |
| **Mitigation** | Create load test scripts (using k6, Artillery, or similar) targeting critical paths: login, POS transactions, invoice generation, and dashboard loading. Establish baseline performance metrics and run tests regularly. |

### 3.6 No Backup and Disaster Recovery Plan

| Field | Value |
|---|---|
| **Severity** | High |
| **Location** | Database and infrastructure |
| **Description** | There is no documented backup strategy, recovery point objective (RPO), or recovery time objective (RTO). Loss of the database or cloud storage could result in permanent data loss. |
| **Mitigation** | Implement automated daily database backups with point-in-time recovery. Document the disaster recovery procedure, including R2 object restoration. Test the restore process quarterly. |

### 3.7 JWT Tokens Not Revocable

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | `src/lib/auth.ts` |
| **Description** | JWTs are stateless and expire after 24 hours. There is no token blocklist or revocation mechanism. If a user's session is compromised or their account is deactivated, the token remains valid until it naturally expires. |
| **Mitigation** | Implement a server-side token blocklist (Redis or database table) for logout and account deactivation. Alternatively, reduce token lifetime and use short-lived access tokens with refresh tokens. |

### 3.8 No Logging Aggregation or Monitoring

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Location** | System-wide |
| **Description** | Application logs are written to `console.log`/`console.error` and the custom `auditLogger`. There is no centralized log aggregation, structured logging format, or alerting system. Debugging production issues requires SSH access to the server and manual log inspection. |
| **Mitigation** | Adopt structured JSON logging. Integrate with a log aggregation service (e.g., Datadog, Grafana Loki, AWS CloudWatch). Set up alerts for error rate spikes, slow queries, and authentication failures. |

### 3.9 No Environment-Specific Configuration Management

| Field | Value |
|---|---|
| **Severity** | Low |
| **Location** | Project root |
| **Description** | There is no `.env.example`, no environment validation at startup, and no documentation of required environment variables. Deployment misconfiguration is likely, especially as the team grows. |
| **Mitigation** | Create `.env.example` with all required variables. Add startup validation (using Zod or a similar library) that fails fast if critical variables are missing. Document environment setup in the README. |

---

## 4. Risk Summary Matrix

| # | Risk | Severity | Category | Status |
|---|---|---|---|---|
| 1.1 | JWT secret fallback | Critical | Security | Open |
| 1.2 | No rate limiting on auth | Critical | Security | Open |
| 1.3 | RBAC API unprotected | High | Security | Open |
| 1.4 | No input validation | High | Security | Open |
| 1.5 | No CSRF protection | Medium | Security | Open |
| 1.6 | No security headers | Medium | Security | Open |
| 1.7 | No XSS sanitization for chat | Medium | Security | Open |
| 1.8 | Header-based identity injection | High | Security | Open |
| 1.9 | CORS not configured | Low | Security | Open |
| 1.10 | MIME-only file validation | Medium | Security | Open |
| 1.11 | No `.env.example` | Low | Security | Open |
| 2.1 | User creation across companies | Medium | Functional | **Resolved** |
| 2.2 | Middleware deprecation | Medium | Functional | Open |
| 2.3 | No real-time updates | Medium | Functional | Open |
| 2.4 | Turbopack cache corruption | Low | Functional | Open |
| 2.5 | Generic error handling | Medium | Functional | Open |
| 2.6 | No pagination on lists | Medium | Functional | Open |
| 3.1 | No WebSocket/SSE | High | Technical | Open |
| 3.2 | Connection pool limits | Medium | Technical | Open |
| 3.3 | No migration strategy docs | Medium | Technical | Open |
| 3.4 | No CI/CD pipeline | High | Technical | Open |
| 3.5 | No load testing | Medium | Technical | Open |
| 3.6 | No backup/DR plan | High | Technical | Open |
| 3.7 | JWT not revocable | Medium | Technical | Open |
| 3.8 | No log aggregation | Medium | Technical | Open |
| 3.9 | No env config management | Low | Technical | Open |

---

## 5. Recommended Priority Order

1. **JWT secret fallback** (1.1) — Immediate fix, one line of code prevents catastrophic token forgery.
2. **Rate limiting on auth** (1.2) — Prevents brute-force attacks on production.
3. **RBAC API authorization** (1.3) — Privilege escalation vector, quick fix.
4. **Header-based identity injection** (1.8) — Deployment-dependent but critical to verify.
5. **Input validation** (1.4) — Systematic improvement, protects against injection and unexpected behavior.
6. **CI/CD pipeline** (3.4) — Foundation for safe, automated deployments.
7. **Backup and DR plan** (3.6) — Essential before handling real business data.
8. **Security headers** (1.6) — Low effort, significant defense-in-depth improvement.
9. **WebSocket/SSE** (3.1) — Scalability requirement as user base grows.
10. **Token revocation** (3.7) — Important for account security lifecycle.
