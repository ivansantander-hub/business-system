/**
 * Third-Party Electronic Payroll (Nómina Electrónica) Integration Module
 *
 * Mirrors the pattern from src/lib/dian.ts for electronic invoicing.
 * Integrates with third-party providers that handle DIAN compliance
 * for electronic payroll (DSNE - Documento Soporte de Pago de Nómina Electrónica).
 *
 * Supported providers: factus, carvajal, worldoffice, siigo_facturacion
 */

import { createHash } from "crypto";

export const SUPPORTED_PAYROLL_PROVIDERS = ["factus", "carvajal", "worldoffice", "siigo_facturacion"] as const;

export type SupportedPayrollProviderName = (typeof SUPPORTED_PAYROLL_PROVIDERS)[number];

export interface SendPayrollDocResult {
  success: boolean;
  cune?: string;
  providerReference?: string;
  message?: string;
}

export interface CheckPayrollStatusResult {
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  message?: string;
}

export interface PayrollProviderConfig {
  apiUrl?: string | null;
  apiKey?: string | null;
  user?: string | null;
  password?: string | null;
}

export interface PayrollDocumentData {
  employeeName: string;
  employeeDocType: string;
  employeeDocNumber: string;
  period: string;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  details: {
    conceptCode: string;
    conceptName: string;
    type: string;
    amount: number;
  }[];
  companyNit: string;
  companyName: string;
}

interface IPayrollProvider {
  sendDocument(data: PayrollDocumentData): Promise<SendPayrollDocResult>;
  checkStatus(cune: string): Promise<CheckPayrollStatusResult>;
}

class StubPayrollProvider implements IPayrollProvider {
  constructor(private config: PayrollProviderConfig) {}

  async sendDocument(data: PayrollDocumentData): Promise<SendPayrollDocResult> {
    console.log(`[PayrollProvider STUB] Sending payroll document for ${data.employeeName}, period ${data.period}`);
    return {
      success: true,
      cune: generatePlaceholderCune(data),
      providerReference: `STUB-${Date.now()}`,
      message: "Documento enviado (modo prueba)",
    };
  }

  async checkStatus(_cune: string): Promise<CheckPayrollStatusResult> {
    return { status: "ACCEPTED", message: "Validado (modo prueba)" };
  }
}

export function createPayrollProvider(providerName: string, config: PayrollProviderConfig): IPayrollProvider {
  switch (providerName) {
    case "factus":
    case "carvajal":
    case "worldoffice":
    case "siigo_facturacion":
      return new StubPayrollProvider(config);
    default:
      throw new Error(`Unsupported payroll provider: ${providerName}`);
  }
}

export function generatePlaceholderCune(data: PayrollDocumentData): string {
  const raw = `${data.companyNit}|${data.employeeDocNumber}|${data.period}|${data.netPay}|${Date.now()}`;
  return createHash("sha384").update(raw).digest("hex");
}
