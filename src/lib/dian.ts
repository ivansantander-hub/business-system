/**
 * DIAN Electronic Invoicing Module - Preparation Layer
 *
 * This module provides the foundational structure for integrating with
 * Colombia's DIAN electronic invoicing system. The actual DIAN API
 * integration will be implemented in a future module.
 *
 * Current capabilities:
 * - UBL 2.1 XML generation (see invoice-export.ts)
 * - CUFE placeholder generation
 * - Invoice numbering with DIAN authorized ranges
 * - Company tax information management
 *
 * Future implementation will require:
 * - DIAN test environment (Habilitación)
 * - Digital certificate (X.509) for signing
 * - CUFE generation with SHA-384
 * - QR code generation
 * - Real-time validation with DIAN API
 * - Nota crédito / Nota débito electronic documents
 */

import { createHash } from "crypto";

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
