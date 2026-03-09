# SGC — Sistema de Gestión Comercial

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Jotai](https://img.shields.io/badge/Jotai-State_Management-5A67D8)](https://jotai.org/)
[![Vitest](https://img.shields.io/badge/Vitest-Testing-6E9F18)](https://vitest.dev/)

Sistema integral de gestión comercial para empresas de tipo **Restaurante/Bar** y **Gimnasio**. Incluye punto de venta (POS), inventario, facturación, contabilidad colombiana (PUC), membresías, check-in y más.

## Características principales

- **Multi-tenant** — Varias empresas en una sola instancia, con cambio de contexto
- **Control de acceso basado en roles (RBAC)** — Permisos personalizables por empresa con panel administrativo
- **Contabilidad colombiana** — Plan Único de Cuentas (PUC), IVA 19%, moneda COP
- **Punto de venta (POS)** — Ventas, mesas, órdenes, facturación
- **Gestión de gimnasio** — Membresías, check-in, tiqueteras, clases, casilleros, medidas corporales
- **Gestión de restaurante** — Mesas, órdenes, meseros
- **Modo oscuro/claro** — Soporte completo con toggle manual
- **Gestión de estado con Jotai** — Atoms para theme, auth y permisos
- **Concurrencia segura** — Transacciones serializables, reintentos automáticos
- **Sistema de emails transaccionales (Brevo)** — Notificaciones en ventas, compras, membresías, tiqueteras, facturas
- **Recuperación de contraseña** — Flujo completo con token y email
- **Panel de notificaciones** — Gestión por empresa, rol y usuario
- **Almacenamiento R2 (Cloudflare)** — PDFs de facturas y compras, fotos de perfil
- **Generación automática de PDFs** — Facturas y órdenes de compra en PDF con diseño profesional
- **Perfil de usuario** — Gestión de info personal, contraseña y foto de perfil
- **Test suite completa** — Concurrencia, API, Email, E2E, R2/PDF (ejecución unificada con `pnpm test:all`)
- **Visor de resultados de tests** — Panel para SUPER_ADMIN con screenshots E2E desde R2
- **Historial de actividad por usuario** — Desde gestión de usuarios, con links de navegación a entidades
- **Centro de Auditoría** — Pista de auditoría completa con estado antes/después, checksums SHA-256, Línea de Vida por entidad
- **Auditoría centralizada** — Búsqueda de entidades, ciclo de vida de productos, historial de clientes, dashboard con 4 pestañas
- **Sistema de auditoría** — Logging centralizado (singleton), trazabilidad de usuario, visor de admin y perfil
- **Exportación de facturas** — XML UBL 2.1, Excel y PDF
- **Contabilidad ampliada** — Balance General, Estado de Resultados (P&L), Balance de Comprobación
- **Preparación DIAN** — Resolución, prefijo, rangos y actividad económica configurables por empresa
- **Módulo de Facturación Electrónica (DIAN)** — Activatable por empresa, generación CUFE, validación de rangos DIAN, gestión de configuración
- **Estructura de carpetas de facturas en R2** — PDF + XML + Excel por factura
- **Política de retención** — Años de retención documental configurables por empresa
- **Notas crédito/débito** — Modelo de notas asociadas a facturas
- **Screenshots E2E** — Capturas automáticas de cada test, subidas a R2
- **Sistema de sucursales** — Empresas con múltiples sucursales; usuarios asignados por sucursal; entidades (facturas, compras, etc.) con alcance por sucursal
- **Notificaciones internas** — Emails almacenados como notificaciones en BD; seguimiento leído/no leído por usuario; campana en header; bandeja de entrada
- **Mensajería interna** — DMs usuario a usuario y conversaciones grupales; adjuntos; emojis; controlado por RBAC
- **Logo de empresa** — Subida de icono vía R2; mostrado en sidebar y página de configuración
- **Ejecutor manual de tests** — SUPER_ADMIN puede ejecutar tests E2E desde la UI y ver resultados en vivo
- **Facturación electrónica por terceros** — Modelo de proveedores (Factus, Carvajal, WorldOffice, Siigo) en lugar de integración directa con DIAN

## Requisitos previos

- **Node.js** 18 o superior
- **PostgreSQL** 14 o superior
- **pnpm** (recomendado) o npm/yarn

## Inicio rápido

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd business-system
pnpm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/business_system"
JWT_SECRET="tu-secreto-jwt-seguro-min-32-caracteres"
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="tu-email-brevo@ejemplo.com"
SMTP_PASS="tu-smtp-key-de-brevo"
SMTP_FROM_EMAIL="noreply@tuempresa.com"
SMTP_FROM_NAME="SGC - Sistema de Gestión Comercial"
R2_ACCOUNT_ID="tu-cloudflare-account-id"
R2_ACCESS_KEY_ID="tu-r2-access-key"
R2_SECRET_ACCESS_KEY="tu-r2-secret-key"
R2_BUCKET_NAME="business-system"
R2_ENDPOINT="https://tu-account-id.r2.cloudflarestorage.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Base de datos

```bash
pnpm db:generate   # Genera el cliente Prisma
pnpm db:push       # Crea tablas y esquemas (public + tenant)
pnpm db:seed       # Inserta datos iniciales (usuarios, empresa demo, categorías)
```

### 4. Servidor de desarrollo

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) y accede con las credenciales por defecto.

## Credenciales por defecto

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| Super Administrador | master@sistema.com | master123 | SUPER_ADMIN |
| Administrador | admin@miempresa.com | admin123 | ADMIN |
| Cajero Principal | cajero@miempresa.com | cajero123 | CASHIER |
| Mesero 1 | mesero@miempresa.com | mesero123 | WAITER |
| Contador | contador@miempresa.com | contador123 | ACCOUNTANT |

> **Importante:** Cambia las contraseñas en producción.

## Estructura del proyecto

```
business-system/
├── prisma/
│   ├── schema.prisma    # Modelos y esquemas (public + tenant)
│   └── seed.ts         # Datos iniciales
├── src/
│   ├── app/            # App Router (Next.js)
│   │   ├── api/        # Rutas API REST
│   │   ├── dashboard/  # Páginas del dashboard
│   │   └── login/      # Página de login
│   ├── components/
│   │   ├── atoms/      # Componentes básicos (Button, Input, Badge…)
│   │   ├── molecules/  # Componentes compuestos (FormField, DataTable…)
│   │   ├── organisms/  # Sidebar, Header
│   │   └── templates/  # DashboardLayout, AuthLayout
│   ├── store/          # Jotai atoms (theme, auth, permissions)
│   ├── lib/            # auth, prisma, rbac, accounting, sale, email, audit-logger
│   └── quarks/         # Tokens de diseño (colores, espaciado, tipografía)
├── tests/              # Vitest + Playwright tests
├── docs/               # Documentación
├── vitest.config.ts
└── tailwind.config.ts
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Servidor de desarrollo (Next.js con Turbopack) |
| `pnpm build` | Build de producción |
| `pnpm start` | Servidor de producción |
| `pnpm db:generate` | Genera el cliente Prisma |
| `pnpm db:push` | Sincroniza el esquema con la base de datos |
| `pnpm db:seed` | Ejecuta el seed (datos iniciales) |
| `pnpm db:studio` | Abre Prisma Studio |
| `pnpm setup` | `db:generate` + `db:push` + `db:seed` |
| `pnpm test` | Ejecuta todos los tests (Vitest) — 82 tests |
| `pnpm test:watch` | Tests en modo watch |
| `pnpm test:concurrency` | Tests de concurrencia (6 tests) |
| `pnpm test:api` | Tests de API (42 tests, requiere servidor) |
| `pnpm test:email` | Tests del sistema de email (17 tests) |
| `pnpm test:r2` | Tests unitarios R2/PDF (9 tests) |
| `pnpm test:r2-integration` | Tests integración R2 live (8 tests, requiere servidor + R2) |
| `pnpm test:e2e` | Tests E2E Playwright con screenshots (29 tests, requiere servidor) |
| `pnpm test:upload-logs` | Sube screenshots E2E y logs a R2 |
| `pnpm test:all` | **Inicia servidor** + ejecuta todos los tests + sube a R2 (un solo comando) |

## Documentación adicional

- [Arquitectura](docs/ARCHITECTURE.md) — Multi-tenant, autenticación, contabilidad
- [Componentes](docs/COMPONENTS.md) — Atomic Design, átomos, moléculas, organismos
- [Sistema de diseño](docs/DESIGN-SYSTEM.md) — Colores, tipografía, clases CSS
- [Testing](docs/TESTING.md) — Vitest, Playwright, ejecutor manual, estrategia de pruebas
- [Concurrencia](docs/CONCURRENCY.md) — Transacciones, aislamiento, reintentos
- [Emails y notificaciones](docs/EMAILS.md) — Brevo, templates, preferencias
- [Notificaciones internas](docs/NOTIFICATIONS.md) — Bandeja de entrada, DB, leído/no leído
- [Auditoría](docs/AUDITING.md) — Sistema de logging, singleton, visor admin
- [Facturación Electrónica](docs/ELECTRONIC-INVOICING.md) — Proveedores terceros, CUFE, rangos
- [Sucursales](docs/BRANCHES.md) — API, configuración, asignación de usuarios
- [Mensajería](docs/MESSAGING.md) — DMs, grupos, adjuntos, RBAC
- [Referencia API](docs/API-REFERENCE.md) — Endpoints REST

## Licencia

MIT
