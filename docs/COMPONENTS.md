# Component Reference

This document describes the UI component library organized by Atomic Design methodology.

## Atomic Design Hierarchy

```
Quarks (tokens) → Atoms → Molecules → Organisms → Templates → Pages
     │              │          │           │            │
     │              │          │           │            └── Full page compositions
     │              │          │           └── Sidebar, Header
     │              │          └── FormField, StatCard, DataTable, etc.
     │              └── Button, Input, Badge, etc.
     └── colors, spacing, typography, shadows, animations
```

## Directory Structure

```
src/
├── quarks/                 # Design tokens (no React)
│   ├── index.ts
│   ├── colors.ts
│   ├── spacing.ts
│   ├── typography.ts
│   ├── shadows.ts
│   └── animations.ts
├── components/
│   ├── atoms/              # Smallest UI units
│   │   ├── index.ts        # Barrel exports
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Textarea.tsx
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   ├── Avatar.tsx
│   │   └── Label.tsx
│   ├── molecules/          # Composed atoms
│   │   ├── index.ts
│   │   ├── FormField.tsx
│   │   ├── SelectField.tsx
│   │   ├── StatCard.tsx
│   │   ├── PageHeader.tsx
│   │   ├── SearchInput.tsx
│   │   ├── EmptyState.tsx
│   │   ├── DataTable.tsx
│   │   └── ConfirmDialog.tsx
│   ├── organisms/          # Complex sections
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── templates/          # Page layouts
│   │   ├── DashboardLayout.tsx
│   │   └── AuthLayout.tsx
│   └── ui/                 # Shared UI (Modal, Toast)
├── store/                  # Jotai atoms (theme, auth, permissions)
```

---

## Quarks (Design Tokens)

Quarks are exported from `@/quarks` and used for programmatic styling (e.g. in custom components or tests). Tailwind and `globals.css` provide the primary styling layer.

### Colors (`colors`)

| Token | Values |
|-------|--------|
| `primary` | 50–900 (violet scale) |
| `neutral` | 0, 50–950 (slate scale) |
| `success` | 50, 500–700 (emerald) |
| `danger` | 50, 500–700 (red) |
| `warning` | 50, 500–700 (amber) |
| `info` | 50, 500–700 (blue) |
| `surface` | light, dark, card, sidebar |

### Spacing (`spacing`, `breakpoints`)

| Token | Example |
|-------|---------|
| `spacing` | px, 0, 0.5, 1–24 (rem) |
| `breakpoints` | sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px |

### Typography (`typography`)

| Token | Values |
|-------|--------|
| `fontFamily` | sans (Inter), mono |
| `fontSize` | xs, sm, base, lg, xl, 2xl, 3xl, 4xl |
| `fontWeight` | normal, medium, semibold, bold, extrabold |
| `lineHeight` | tight, normal, relaxed |

### Shadows (`shadows`)

| Token | Use |
|-------|-----|
| sm, card, cardHover, cardDark, cardDarkHover | Cards |
| glowSm, glow, glowLg | Accent glow |
| xl | Large elevation |

### Animations (`animations`)

| Token | Values |
|-------|--------|
| `duration` | fast: 150ms, normal: 200ms, slow: 300ms, slower: 500ms |
| `easing` | default, in, out, inOut, spring |

---

## Atoms

### Button

Primary interactive element for user actions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"primary" \| "secondary" \| "danger" \| "success" \| "ghost"` | `"primary"` | Visual style |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size |
| `loading` | `boolean` | `false` | Shows spinner, disables button |
| `icon` | `ReactNode` | — | Icon before children |
| `className` | `string` | `""` | Additional classes |
| + `ButtonHTMLAttributes` | — | — | Standard button props |

```tsx
<Button variant="primary" size="md">Guardar</Button>
<Button variant="danger" size="sm" loading>Eliminando…</Button>
<Button variant="secondary" icon={<Plus />}>Nuevo</Button>
```

### Input

Text input field with `input-field` base styling.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `boolean` | `false` | Red border and focus ring |
| `className` | `string` | `""` | Additional classes |
| + `InputHTMLAttributes` | — | — | Standard input props |

```tsx
<Input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
<Input error={!!errors.email} type="email" name="email" />
```

### Select

Dropdown select with custom styling.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `boolean` | `false` | Red border |
| `className` | `string` | `""` | Additional classes |
| + `SelectHTMLAttributes` | — | — | Standard select props |

```tsx
<Select value={role} onChange={e => setRole(e.target.value)}>
  <option value="ADMIN">Admin</option>
</Select>
```

### Textarea

Multi-line text input.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | `boolean` | `false` | Red border |
| `className` | `string` | `""` | Additional classes |
| + `TextareaHTMLAttributes` | — | — | Standard textarea props |

```tsx
<Textarea rows={3} placeholder="Notas…" />
```

### Badge

Status indicator label.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"success" \| "danger" \| "warning" \| "info" \| "neutral"` | `"neutral"` | Color variant |
| `children` | `ReactNode` | — | Label text |
| `className` | `string` | `""` | Additional classes |

```tsx
<Badge variant="success">Activo</Badge>
<Badge variant="danger">Cancelado</Badge>
```

### Spinner

Loading indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size (4/8/12) |
| `className` | `string` | `""` | Additional classes |

```tsx
<Spinner size="md" />
```

### Avatar

User or entity visual identifier (initials on gradient background).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | `""` | Used for initials (first 2 letters) |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size |
| `className` | `string` | `""` | Additional classes |

```tsx
<Avatar name="Ivan Santander" size="md" />
```

### Label

Form label element.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `required` | `boolean` | — | Shows red asterisk |
| `children` | `ReactNode` | — | Label text |
| + `LabelHTMLAttributes` | — | — | Standard label props |

```tsx
<Label htmlFor="email">Correo electrónico</Label>
<Label htmlFor="name" required>Nombre</Label>
```

---

## Molecules

### FormField

Label + Input + error message.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text |
| `error` | `string` | — | Error message (shows below input) |
| `icon` | `ReactNode` | — | Icon inside input (left) |
| `id` | `string` | — | Overrides `name` for `htmlFor` |
| + `InputHTMLAttributes` | — | — | Passed to Input |

```tsx
<FormField label="Nombre" name="name" value={name} onChange={e => setName(e.target.value)} required />
<FormField label="Email" name="email" error={errors.email} type="email" />
```

### SelectField

Label + Select + error message.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text |
| `error` | `string` | — | Error message |
| `options` | `{ value: string; label: string }[]` | — | Select options |
| `placeholder` | `string` | — | First empty option |
| + `SelectHTMLAttributes` | — | — | Passed to Select |

```tsx
<SelectField label="Rol" name="role" options={roleOptions} value={role} onChange={e => setRole(e.target.value)} />
```

### StatCard

Dashboard metric display card.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Metric label |
| `value` | `string \| number` | — | Metric value |
| `icon` | `ReactNode` | — | Icon (Lucide) |
| `gradient` | `string` | `"from-violet-500 to-indigo-600"` | Tailwind gradient classes |
| `accent` | `boolean` | `false` | Full gradient background (white text) |

```tsx
<StatCard label="Ventas Hoy" value="$1,200,000" icon={<DollarSign />} accent />
<StatCard label="Productos" value={42} icon={<Package />} gradient="from-emerald-500 to-emerald-600" />
```

### PageHeader

Page title with icon and optional actions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | — | Icon in page-icon container |
| `title` | `string` | — | Page title |
| `subtitle` | `string` | — | Optional subtitle |
| `actions` | `ReactNode` | — | Right-side actions (e.g. Button) |

```tsx
<PageHeader icon={<Package />} title="Productos" actions={<Button>Nuevo</Button>} />
<PageHeader icon={<Users />} title="Clientes" subtitle="Gestiona tu cartera de clientes" />
```

### SearchInput

Input with search icon and optional clear button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Controlled value |
| `onChange` | `(e: ChangeEvent<HTMLInputElement>) => void` | — | Change handler |
| `onClear` | `() => void` | — | If provided, shows clear button when value is non-empty |
| `placeholder` | `string` | `"Buscar…"` | Placeholder |
| `className` | `string` | `""` | Additional classes |

```tsx
<SearchInput value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ("")} placeholder="Buscar productos…" />
```

### EmptyState

Placeholder for empty data areas.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | — | Optional icon |
| `title` | `string` | — | Main message |
| `description` | `string` | — | Secondary text |
| `action` | `ReactNode` | — | CTA (e.g. Button) |

```tsx
<EmptyState icon={<Package />} title="Sin productos" description="Agrega tu primer producto" action={<Button>Crear producto</Button>} />
```

### DataTable

Responsive table wrapper with headers and empty state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `headers` | `{ label: string; className?: string }[]` | — | Column headers |
| `children` | `ReactNode` | — | Table rows (`<tr>`) |
| `empty` | `boolean` | — | Show empty message instead of children |
| `emptyMessage` | `string` | `"Sin datos"` | Empty state text |
| `emptyIcon` | `ReactNode` | — | Optional icon in empty state |

```tsx
<DataTable
  headers={[{ label: "Nombre" }, { label: "Email" }, { label: "Rol" }]}
  empty={items.length === 0}
  emptyMessage="Sin resultados"
>
  {items.map(i => <tr key={i.id}>...</tr>)}
</DataTable>
```

### ConfirmDialog

Confirmation modal for destructive actions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Visibility |
| `onConfirm` | `() => void` | — | Confirm handler |
| `onCancel` | `() => void` | — | Cancel handler |
| `title` | `string` | `"Confirmar acción"` | Modal title |
| `message` | `string` | `"Esta acción no se puede deshacer."` | Body text |
| `confirmLabel` | `string` | `"Confirmar"` | Confirm button text |
| `loading` | `boolean` | — | Disables confirm, shows loading |

```tsx
<ConfirmDialog
  open={show}
  onConfirm={handleDelete}
  onCancel={() => setShow(false)}
  title="Eliminar producto"
  message="¿Está seguro? Esta acción no se puede deshacer."
  confirmLabel="Eliminar"
  loading={deleting}
/>
```

---

## Organisms

### Sidebar

Main application navigation. Composes Avatar patterns and nav links.

- **Props:** `collapsed: boolean`, `onToggle: () => void`
- **Behavior:** Reads `permissionsAtom`, `userRoleAtom`, `userNameAtom` from Jotai store; filters menu by RBAC permissions and company type. Collapsible on desktop; mobile drawer overlay. Grouped navigation (Principal, Ventas, Gimnasio, Inventario, Finanzas, Sistema).
- **Location:** `src/components/organisms/Sidebar.tsx`

### Header

Application top bar with company switcher, theme toggle, user info.

- **Props:** None (uses Jotai atoms: `authUserAtom`, `themeAtom`, `toggleThemeAtom` from `@/store`)
- **Behavior:** Company dropdown for users with multiple companies; theme toggle via Jotai `toggleThemeAtom`; user avatar and name from `authUserAtom`.
- **Location:** `src/components/organisms/Header.tsx`

---

## Templates

### DashboardLayout

Main application layout with sidebar, header, and content area.

- **Props:** `children: ReactNode`
- **Composition:** Sidebar (organism), Header (organism)
- **Behavior:** Collapsible sidebar; main content area with max-width; responsive (mobile drawer for sidebar).
- **Location:** `src/components/templates/DashboardLayout.tsx`

### AuthLayout

Centered layout for authentication pages (login, etc.).

- **Props:** `children: ReactNode`
- **Behavior:** Full-screen dark background with gradient blurs; centered max-w-md content area.
- **Location:** `src/components/templates/AuthLayout.tsx`

---

## Import Patterns

Use barrel exports from index files:

```tsx
// Atoms
import { Button, Input, Badge, Spinner, Avatar, Label } from "@/components/atoms";

// Molecules
import { FormField, SelectField, StatCard, PageHeader, SearchInput, EmptyState, DataTable, ConfirmDialog } from "@/components/molecules";

// Organisms
import { Sidebar, Header } from "@/components/organisms";

// Templates
import DashboardLayout from "@/components/templates/DashboardLayout";
import AuthLayout from "@/components/templates/AuthLayout";

// Quarks (tokens)
import { colors, spacing, typography, shadows, animations } from "@/quarks";
```

## Composition Rules

1. **Atoms** — No other atoms/molecules; use quarks via Tailwind or globals.css classes.
2. **Molecules** — Compose atoms; keep single responsibility.
3. **Organisms** — Compose molecules and atoms; can fetch data.
4. **Templates** — Compose organisms; define page structure.
5. **Pages** — Use templates; handle route-specific data and logic.
