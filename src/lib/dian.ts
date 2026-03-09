/**
 * Third-Party E-Invoicing Integration Module
 *
 * This module provides the foundational structure for integrating with
 * third-party electronic invoicing providers (Factus, Carvajal, WorldOffice,
 * Siigo Facturación, etc.) that handle DIAN compliance on behalf of the company.
 *
 * Current capabilities:
 * - Third-party provider abstraction (sendInvoice, checkStatus, cancelInvoice)
 * - Provider factory with stub implementations
 * - UBL 2.1 XML generation (see invoice-export.ts)
 * - CUFE placeholder generation (preparation layer)
 * - Invoice numbering with DIAN authorized ranges
 * - Company tax information management
 *
 * Supported providers: factus, carvajal, worldoffice, siigo_facturacion
 */

import { createHash } from "crypto";

/** Supported third-party e-invoice provider identifiers */
export const SUPPORTED_PROVIDERS = ["factus", "carvajal", "worldoffice", "siigo_facturacion"] as const;

export type SupportedProviderName = (typeof SUPPORTED_PROVIDERS)[number];

/** Result of sending an invoice to a provider */
export interface SendInvoiceResult {
  success: boolean;
  providerReference?: string;
  message?: string;
}

/** Result of checking invoice status */
export interface CheckStatusResult {
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  message?: string;
}

/** Result of canceling an invoice */
export interface CancelInvoiceResult {
  success: boolean;
  message?: string;
}

/** Configuration for a third-party e-invoice provider */
export interface EInvoiceProviderConfig {
  apiUrl?: string | null;
  apiKey?: string | null;
  user?: string | null;
  password?: string | null;
}

/**
 * Interface for third-party electronic invoicing providers.
 * Implementations handle DIAN submission, status checks, and cancellations.
 */
export interface ThirdPartyEInvoiceProvider {
  sendInvoice(invoiceData: unknown, config: EInvoiceProviderConfig): Promise<SendInvoiceResult>;
  checkStatus(invoiceId: string, config: EInvoiceProviderConfig): Promise<CheckStatusResult>;
  cancelInvoice(invoiceId: string, config: EInvoiceProviderConfig): Promise<CancelInvoiceResult>;
}

/** Creates a stub provider implementation for development/testing */
function createStubProvider(name: string): ThirdPartyEInvoiceProvider {
  return {
    async sendInvoice() {
      return { success: true, providerReference: `stub-${name}-${Date.now()}`, message: "Stub: invoice would be sent" };
    },
    async checkStatus() {
      return { status: "PENDING", message: "Stub: status check not implemented" };
    },
    async cancelInvoice() {
      return { success: true, message: "Stub: cancellation would be processed" };
    },
  };
}

/**
 * Returns a third-party e-invoice provider by name.
 * Currently returns stub implementations; real integrations will be added per provider.
 */
export function getEInvoiceProvider(providerName: string): ThirdPartyEInvoiceProvider {
  const normalized = providerName?.toLowerCase().trim() || "";
  if (SUPPORTED_PROVIDERS.includes(normalized as SupportedProviderName)) {
    return createStubProvider(normalized);
  }
  return createStubProvider("unknown");
}

/**
 * Document types per DIAN specification
 */
export const DIAN_DOCUMENT_TYPES = {
  INVOICE: "01",
  CREDIT_NOTE: "91",
  DEBIT_NOTE: "92",
} as const;

/**
 * Payment method codes for DIAN
 */
export const DIAN_PAYMENT_CODES: Record<string, string> = {
  CASH: "10",
  CARD: "48",
  TRANSFER: "42",
  CREDIT: "30",
};

/**
 * Tax scheme codes
 */
export const DIAN_TAX_SCHEMES = {
  IVA: "01",
  INC: "04",
  ICA: "03",
  RETEFUENTE: "06",
} as const;

/**
 * Generate a placeholder CUFE (Código Único de Factura Electrónica).
 * In production, this will use SHA-384 with the actual DIAN algorithm:
 * CUFE = SHA384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + ... + NitOFE + NumAdq + ClTec + TipoAmbiente)
 */
export function generatePlaceholderCufe(invoiceNumber: string, nit: string, total: number, date: string): string {
  const input = `${invoiceNumber}${date}${total.toFixed(2)}01${nit}`;
  return createHash("sha384").update(input).digest("hex");
}

/**
 * Validate that an invoice number is within the DIAN authorized range
 */
export function validateDianRange(
  invoiceNumber: number,
  rangeFrom: number | null,
  rangeTo: number | null
): { valid: boolean; message?: string } {
  if (rangeFrom === null || rangeTo === null) {
    return { valid: true };
  }

  if (invoiceNumber < rangeFrom) {
    return { valid: false, message: `Número ${invoiceNumber} está por debajo del rango autorizado (${rangeFrom})` };
  }
  if (invoiceNumber > rangeTo) {
    return { valid: false, message: `Número ${invoiceNumber} excede el rango autorizado (${rangeTo})` };
  }

  const remaining = rangeTo - invoiceNumber;
  if (remaining < 100) {
    return { valid: true, message: `Advertencia: quedan ${remaining} números en el rango autorizado` };
  }

  return { valid: true };
}

/**
 * Colombian tax regimes
 */
export const TAX_REGIMES = [
  { code: "48", name: "Responsable de IVA (Régimen Común)" },
  { code: "49", name: "No Responsable de IVA (Régimen Simplificado)" },
] as const;

/**
 * Colombian tax responsibilities
 */
export const TAX_RESPONSIBILITIES = [
  { code: "O-13", name: "Gran contribuyente" },
  { code: "O-15", name: "Autorretenedor" },
  { code: "O-23", name: "Agente de retención IVA" },
  { code: "O-47", name: "Régimen simple de tributación" },
  { code: "R-99-PN", name: "No aplica" },
] as const;
