import ExcelJS from "exceljs";

interface InvoiceExportData {
  invoiceNumber: string;
  date: string;
  companyName: string;
  companyNit: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyCity?: string | null;
  companyDepartment?: string | null;
  taxRegime?: string | null;
  economicActivity?: string | null;
  dianResolution?: string | null;
  customerName?: string | null;
  customerNit?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
}

/**
 * Generate UBL 2.1 XML for DIAN electronic invoicing preparation.
 * This produces a valid UBL 2.1 structure that can be extended
 * with DIAN-specific CUFE/QR when the electronic invoicing module is built.
 */
export function generateInvoiceXml(data: InvoiceExportData): string {
  const escapeXml = (s: string | null | undefined) =>
    (s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  const itemsXml = data.items
    .map(
      (item, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${item.total.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${escapeXml(item.name)}</cbc:Description>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>DIAN 2.1</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1</cbc:ProfileID>
  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${data.date}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cbc:Note>${escapeXml(data.notes || "")}</cbc:Note>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  ${data.dianResolution ? `<ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <dian:AuthorizationProvider>${escapeXml(data.dianResolution)}</dian:AuthorizationProvider>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>` : ""}
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(data.companyName)}</cbc:Name>
      </cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID schemeID="NIT">${escapeXml(data.companyNit)}</cbc:CompanyID>
        <cbc:TaxLevelCode>${escapeXml(data.taxRegime || "Régimen Común")}</cbc:TaxLevelCode>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(data.companyName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        ${data.companyPhone ? `<cbc:Telephone>${escapeXml(data.companyPhone)}</cbc:Telephone>` : ""}
        ${data.companyEmail ? `<cbc:ElectronicMail>${escapeXml(data.companyEmail)}</cbc:ElectronicMail>` : ""}
      </cac:Contact>
      ${data.companyAddress ? `<cac:PostalAddress>
        <cbc:StreetName>${escapeXml(data.companyAddress)}</cbc:StreetName>
        ${data.companyCity ? `<cbc:CityName>${escapeXml(data.companyCity)}</cbc:CityName>` : ""}
        ${data.companyDepartment ? `<cbc:CountrySubentity>${escapeXml(data.companyDepartment)}</cbc:CountrySubentity>` : ""}
        <cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>` : ""}
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(data.customerName || "Consumidor Final")}</cbc:Name>
      </cac:PartyName>
      ${data.customerNit ? `<cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(data.customerNit)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>01</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>` : ""}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${data.paymentMethod === "CASH" ? "10" : data.paymentMethod === "CARD" ? "48" : data.paymentMethod === "TRANSFER" ? "42" : "30"}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${data.tax.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="COP">${(data.subtotal - data.discount).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="COP">${data.tax.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${(data.taxRate * 100).toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${data.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${(data.subtotal - data.discount).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${data.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    ${data.discount > 0 ? `<cbc:AllowanceTotalAmount currencyID="COP">${data.discount.toFixed(2)}</cbc:AllowanceTotalAmount>` : ""}
    <cbc:PayableAmount currencyID="COP">${data.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${itemsXml}
</Invoice>`;
}

/**
 * Generate Excel workbook with invoice data and Colombian accounting details.
 */
export async function generateInvoiceExcel(data: InvoiceExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.companyName;
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Factura");

  ws.columns = [
    { header: "", width: 20 },
    { header: "", width: 30 },
    { header: "", width: 15 },
    { header: "", width: 15 },
    { header: "", width: 18 },
  ];

  const titleRow = ws.addRow([`FACTURA ${data.invoiceNumber}`]);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells("A1:E1");

  ws.addRow([]);
  ws.addRow(["Emisor:", data.companyName]);
  ws.addRow(["NIT:", data.companyNit]);
  if (data.companyAddress) ws.addRow(["Dirección:", data.companyAddress]);
  if (data.companyPhone) ws.addRow(["Teléfono:", data.companyPhone]);
  if (data.companyEmail) ws.addRow(["Email:", data.companyEmail]);
  if (data.taxRegime) ws.addRow(["Régimen:", data.taxRegime]);
  if (data.dianResolution) ws.addRow(["Resolución DIAN:", data.dianResolution]);

  ws.addRow([]);
  ws.addRow(["Cliente:", data.customerName || "Consumidor Final"]);
  if (data.customerNit) ws.addRow(["NIT/CC:", data.customerNit]);
  ws.addRow(["Fecha:", data.date]);
  ws.addRow(["Método de Pago:", data.paymentMethod]);
  ws.addRow(["Estado:", data.status]);

  ws.addRow([]);
  const headerRow = ws.addRow(["Producto", "Descripción", "Cantidad", "Precio Unit.", "Total"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  for (const item of data.items) {
    const row = ws.addRow([item.name, "", item.quantity, item.unitPrice, item.total]);
    row.getCell(4).numFmt = "$#,##0.00";
    row.getCell(5).numFmt = "$#,##0.00";
  }

  ws.addRow([]);
  const addTotal = (label: string, value: number) => {
    const row = ws.addRow(["", "", "", label, value]);
    row.getCell(4).font = { bold: true };
    row.getCell(5).numFmt = "$#,##0.00";
    return row;
  };

  addTotal("Subtotal:", data.subtotal);
  if (data.discount > 0) addTotal("Descuento:", data.discount);
  addTotal(`IVA (${(data.taxRate * 100).toFixed(0)}%):`, data.tax);
  const totalRow = addTotal("TOTAL:", data.total);
  totalRow.getCell(4).font = { bold: true, size: 12 };
  totalRow.getCell(5).font = { bold: true, size: 12 };

  if (data.notes) {
    ws.addRow([]);
    ws.addRow(["Notas:", data.notes]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
