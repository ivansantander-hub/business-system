# Payroll System (Nómina)

Technical reference for the Colombian payroll management system.

## Overview

The payroll system handles employee management, salary calculations, social security contributions, labor provisions, and electronic payroll (nómina electrónica DIAN). It complies with Colombian labor law including the Código Sustantivo del Trabajo, Estatuto Tributario, and Resolución 000013 de 2021.

## Module Structure

```
src/
  lib/
    payroll-engine.ts      # Calculation engine (earnings, deductions, provisions)
    payroll-accounting.ts   # Journal entry generation
    payroll-dian.ts         # Electronic payroll provider integration
  app/
    api/
      employees/            # Employee CRUD
      payroll/              # Payroll runs, config, concepts, provisions
    dashboard/
      empleados/            # Employee management UI
      nomina/               # Payroll runs UI
        configuracion/      # Payroll configuration UI
      nomina-electronica/   # Electronic payroll provider config UI
      cocina/               # Kitchen display (restaurant only)
```

## Database Models

| Model | Purpose |
|-------|---------|
| `Employee` | Employee data (personal, labor, payment, tax, social security) |
| `PayrollConfig` | Company-level payroll configuration (rates, UVT, minimum wage) |
| `PayrollConcept` | Configurable earning/deduction concepts |
| `PayrollRun` | A payroll execution for a period |
| `PayrollItem` | Individual employee payroll line within a run |
| `PayrollItemDetail` | Breakdown of each concept per employee |
| `PayrollProvision` | Monthly labor provisions (prima, cesantías, vacaciones) |
| `ElectronicPayrollDocument` | DIAN electronic payroll document tracking |

## Payroll Calculation Engine

### Earnings (Devengados)
- **Salary** (SAL): Prorated by days worked
- **Transport Subsidy** (AUX_TRANS): If salary <= 2x minimum wage
- **Overtime** (HE_D): Hourly rate × 1.25 × hours
- **Night Surcharge** (RN): Hourly rate × 1.75 × hours
- **Sunday/Holiday Surcharge** (RD): Hourly rate × 1.75 × hours
- **Commissions** (COM): Direct amount
- **Bonuses** (BON): Direct amount

### Employee Deductions (Deducciones)
- **Health** (SAL_EMP): IBC × 4%
- **Pension** (PEN_EMP): IBC × 4%
- **Solidarity Fund** (FSP): IBC × 1% (if salary >= 4 SMLMV)
- **Withholding Tax** (RET_FTE): Progressive table based on UVT

### Employer Costs (Costos Empleador)
- **Health** (SAL_ER): IBC × 8.5%
- **Pension** (PEN_ER): IBC × 12%
- **ARL**: IBC × risk level rate (0.522% to 6.96%)
- **Compensation Fund** (CCF): IBC × 4%
- **SENA**: IBC × 2% (if salary < 10 SMLMV)
- **ICBF**: IBC × 3% (if salary < 10 SMLMV)

### Provisions (Provisiones)
- **Prima de servicios**: 8.33%
- **Cesantías**: 8.33%
- **Intereses cesantías**: 12% annual on cesantías (1% monthly)
- **Vacaciones**: 4.17%

### IBC (Ingreso Base de Cotización)
- Ordinary salary: Total earnings
- Integral salary: 70% of base salary

### Withholding Tax Calculation
Uses UVT-based progressive table (2026 values). Deductions include health, pension, voluntary deductions, dependent allowance (10% up to 32 UVT), and 25% exempt income (up to 240 UVT).

## Payroll Run Workflow

```
DRAFT → CALCULATED → APPROVED → PAID
  ↓         ↓           ↓
CANCELLED  CANCELLED  (no cancel after PAID)
```

1. **Create Run** (DRAFT): Define period, frequency
2. **Calculate** (→ CALCULATED): Engine calculates all employees, creates items and details
3. **Approve** (→ APPROVED): Manager review and approval
4. **Pay** (→ PAID): Generates accounting journal entries, marks as paid

## Accounting Integration

When a payroll run is paid, the system generates journal entries:

| Account | Debit | Credit |
|---------|-------|--------|
| 5105 Gastos de Personal | Salaries + Employer SS + Provisions | |
| 5195 Auxilio Transporte | Transport subsidy | |
| 2505 Salarios por Pagar | | Net pay |
| 2365 Retención en la Fuente | | Withholding |
| 2404 Aportes Seguridad Social | | Employee + Employer SS |
| 2510 Provisiones | | Prima + Cesantías + Vacaciones |

## Electronic Payroll (DIAN)

Follows the same third-party provider pattern as electronic invoicing:
- Configure provider (Factus, Carvajal, WorldOffice, Siigo)
- Provider handles XML UBL 2.1 generation, digital signing, and DIAN transmission
- System tracks CUNE and DIAN status per employee document

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create employee |
| GET | `/api/employees/:id` | Get employee detail |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Deactivate employee |
| GET | `/api/payroll` | List payroll runs |
| POST | `/api/payroll` | Create payroll run |
| GET | `/api/payroll/:id` | Get run with items |
| POST | `/api/payroll/:id` | Actions: calculate, approve, pay, cancel |
| GET | `/api/payroll/config` | Get payroll configuration |
| PUT | `/api/payroll/config` | Update payroll configuration |
| GET | `/api/payroll/concepts` | List payroll concepts |
| POST | `/api/payroll/concepts` | Create payroll concept |
| GET | `/api/payroll/provisions` | List provisions |

## RBAC Permissions

| Permission | Description |
|------------|-------------|
| `employees` | Employee management |
| `payroll` | Payroll run execution |
| `payroll_config` | Payroll configuration |
| `electronic_payroll` | Electronic payroll DIAN |

All company types (RESTAURANT, GYM, STORE) have access to payroll features.

## Legal Compliance

- Código Sustantivo del Trabajo
- Estatuto Tributario (withholding tax tables)
- Sistema de Seguridad Social (health, pension, ARL)
- Resolución 000013 de 2021 (nómina electrónica)
- Ley 2155 de 2021 (tax reform)
- UGPP audit compliance (change history, logs, versioning)
