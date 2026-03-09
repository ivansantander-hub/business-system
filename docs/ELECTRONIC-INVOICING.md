# Electronic Invoicing (Facturación Electrónica)

This document describes the electronic invoicing module for Colombia's DIAN (Dirección de Impuestos y Aduanas Nacionales) compliance via **third-party providers**.

## Overview

The system has been refactored from direct DIAN integration to a **third-party provider integration model**: instead of integrating directly with the DIAN API, companies configure an external e-invoicing provider (Factus, Carvajal, WorldOffice, Siigo Facturación) that handles DIAN submission and compliance on their behalf.

When electronic invoicing is enabled per company, invoices are generated with:

- **CUFE** (Código Único de Factura Electrónica) — Unique electronic invoice code (preparation layer)
- **QR code** — For customer verification
- **DIAN range validation** — Ensures invoice numbers stay within authorized ranges
- **UBL 2.1 XML** — Export format compatible with DIAN specifications
- **Third-party provider submission** — Invoices are sent to the configured provider for DIAN validation

## Supported Providers

| Provider | Identifier | Description |
|----------|-------------|-------------|
| Factus | `factus` | Factus electronic invoicing platform |
| Carvajal | `carvajal` | Carvajal Tecnología y Servicios |
| WorldOffice | `worldoffice` | WorldOffice e-invoicing |
| Siigo Facturación | `siigo_facturacion` | Siigo electronic invoicing module |

Each provider requires configuration: API URL, API Key, User, and Password. These are stored per company and used when sending invoices.

## Configuration Flow

1. Go to **Facturación Electrónica** in the dashboard sidebar
2. Toggle **Facturación Electrónica** on
3. In **Proveedor de Facturación**:
   - Select a provider (Factus, Carvajal, WorldOffice, Siigo Facturación)
   - Enter the provider's API URL
   - Enter API Key, User, and Password (masked inputs)
   - Click **Probar Conexión** to verify credentials (stub for now)
4. Configure **Configuración DIAN** (resolution, prefix, range, technical key, etc.)
5. Save configuration

The provider credentials and DIAN settings are stored in the `Company` model and exposed via `GET /api/company/config`.

## Enable/Disable Per Company

Electronic invoicing is **optional and configurable per company**:

1. Go to **Configuración** (Settings) or **Facturación Electrónica** in the sidebar
2. Toggle **Facturación Electrónica** on or off
3. When **enabled**: Invoices use DIAN prefix, CUFE, range validation, and are sent to the third-party provider
4. When **disabled**: Invoices use simple POS numbering without DIAN fields

The `electronicInvoicingEnabled` flag is stored in the `Company` model and exposed via `GET /api/company/config`.

## CUFE Generation

The **CUFE** (Código Único de Factura Electrónica) is a unique code that identifies each electronic invoice. The system uses a placeholder implementation in `src/lib/dian.ts`:

- **Algorithm**: SHA-384 hash of invoice number, date, total, tax code, and NIT
- **Format**: 96-character hex string

In production, the full DIAN algorithm would use:
`SHA384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + ... + NitOFE + NumAdq + ClTec + TipoAmbiente)`

The current implementation provides a deterministic, unique code for each invoice. Future versions will align with the exact DIAN specification and use the **dianTechnicalKey** (Clave Técnica) for signing.

## DIAN Range Validation

When electronic invoicing is enabled, the system validates that each invoice number falls within the **authorized DIAN range**:

- **dianRangeFrom** / **dianRangeTo**: Configured per company (e.g., 1–10000)
- **Validation**: Invoice number must be ≥ rangeFrom and ≤ rangeTo
- **Warning**: When fewer than 100 numbers remain in the range, a warning is shown

Validation is performed in `src/lib/dian.ts` via `validateDianRange()`. If a sale would use a number outside the range, the operation is rejected with an error message.

## Settings Management

The Facturación Electrónica page (`/dashboard/facturacion-electronica`) and Company Config API allow management of:

### Third-Party Provider

| Setting | Description |
|---------|-------------|
| **eInvoiceProvider** | Provider name: `factus`, `carvajal`, `worldoffice`, `siigo_facturacion` |
| **eInvoiceProviderApiUrl** | Provider API base URL |
| **eInvoiceProviderApiKey** | API key for authentication |
| **eInvoiceProviderUser** | Username for provider |
| **eInvoiceProviderPass** | Password for provider |

### DIAN Configuration

| Setting | Description |
|---------|-------------|
| **electronicInvoicingEnabled** | Master toggle for e-invoicing |
| **dianResolution** | DIAN authorization resolution number |
| **dianPrefix** | Invoice number prefix (e.g., `FE`) |
| **dianRangeFrom** | Start of authorized number range |
| **dianRangeTo** | End of authorized number range |
| **dianTechnicalKey** | Technical key for CUFE signing |
| **dianEnvironment** | `HABILITACION` (test) or `PRODUCCION` |
| **dianSoftwareId** | Software ID registered with DIAN |
| **dianSoftwarePin** | Software PIN for DIAN API |
| **dianTestSetId** | Test set ID (for Habilitación) |

Settings are persisted via `PUT /api/company/config` and stored in the `Company` table.

## Invoice Folder Structure in R2

When invoices are generated, the system stores documents in Cloudflare R2 with the following structure:

```
companies/{companyId}/invoices/{invoiceNumber}/
├── factura.pdf    # PDF invoice
├── factura.xml    # UBL 2.1 XML for DIAN
└── factura.xlsx   # Excel export
```

- **PDF**: Human-readable invoice for printing and delivery
- **XML**: UBL 2.1 format required for DIAN electronic invoicing
- **Excel**: Spreadsheet export for accounting and reporting

All three are generated and uploaded when an invoice is created (when R2 is configured).

## Future Roadmap

Planned enhancements for full DIAN compliance:

| Feature | Status |
|---------|--------|
| Digital certificates (X.509) | Planned |
| CUFE with exact DIAN SHA-384 algorithm | Planned |
| Real-time DIAN API integration | Planned |
| DIAN Habilitación environment support | Partial (settings exist) |
| Nota crédito / Nota débito electronic docs | Planned |
| QR code with DIAN verification URL | Planned |

The current module provides the foundational structure (UBL XML, CUFE placeholder, range validation, settings) so that integration with the official DIAN API can be added incrementally.
