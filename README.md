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
- **Control de acceso basado en roles (RBAC)** — Super Admin, Admin, Cajero, Mesero, Contador, Entrenador
- **Contabilidad colombiana** — Plan Único de Cuentas (PUC), IVA 19%, moneda COP
- **Punto de venta (POS)** — Ventas, mesas, órdenes, facturación
- **Gestión de gimnasio** — Membresías, check-in, tiqueteras, clases, casilleros, medidas corporales
- **Gestión de restaurante** — Mesas, órdenes, meseros
- **Modo oscuro/claro** — Soporte completo con toggle manual
- **Gestión de estado con Jotai** — Atoms para theme, auth y permisos
- **Concurrencia segura** — Transacciones serializables, reintentos automáticos
- **Test suite completa** — Concurrencia, API, E2E

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
│   ├── lib/            # auth, prisma, rbac, accounting, sale
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
| `pnpm test` | Ejecuta tests (Vitest) |
| `pnpm test:watch` | Tests en modo watch |
| `pnpm test:concurrency` | Tests de concurrencia |
| `pnpm test:api` | Tests de API |
| `pnpm test:e2e` | Tests E2E |

## Documentación adicional

- [Arquitectura](docs/ARCHITECTURE.md) — Multi-tenant, autenticación, contabilidad
- [Componentes](docs/COMPONENTS.md) — Atomic Design, átomos, moléculas, organismos
- [Sistema de diseño](docs/DESIGN-SYSTEM.md) — Colores, tipografía, clases CSS
- [Testing](docs/TESTING.md) — Vitest, Playwright, estrategia de pruebas
- [Concurrencia](docs/CONCURRENCY.md) — Transacciones, aislamiento, reintentos

## Licencia

MIT
