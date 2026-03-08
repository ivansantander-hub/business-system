import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SENDER_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@sgc.com";
const SENDER_NAME = process.env.SMTP_FROM_NAME || "SGC";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
  }
  return _transporter;
}

export const EMAIL_EVENTS = {
  USER_CREATED: "user_created",
  PASSWORD_RESET: "password_reset",
  SALE_COMPLETED: "sale_completed",
  INVOICE_GENERATED: "invoice_generated",
  PURCHASE_CREATED: "purchase_created",
  PURCHASE_RECEIVED: "purchase_received",
  MEMBERSHIP_CREATED: "membership_created",
  DAYPASS_CREATED: "daypass_created",
  CASH_SESSION_CLOSED: "cash_session_closed",
  ORDER_PAID: "order_paid",
} as const;

export type EmailEvent = (typeof EMAIL_EVENTS)[keyof typeof EMAIL_EVENTS];

export const EVENT_LABELS: Record<EmailEvent, string> = {
  user_created: "Usuario creado",
  password_reset: "Recuperación de contraseña",
  sale_completed: "Venta completada",
  invoice_generated: "Factura generada",
  purchase_created: "Compra creada",
  purchase_received: "Compra recibida",
  membership_created: "Membresía creada",
  daypass_created: "Tiquetera creada",
  cash_session_closed: "Cierre de caja",
  order_paid: "Orden pagada",
};

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const smtp = getTransporter();
  if (!smtp) {
    console.warn("SMTP credentials not configured, skipping email");
    return false;
  }

  try {
    const info = await smtp.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
      subject: params.subject,
      html: params.htmlContent,
    });

    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("SMTP send error:", error);
    return false;
  }
}

/**
 * Check if a notification event is enabled for a company (and optionally a user).
 * If no record exists, defaults to enabled.
 */
export async function isNotificationEnabled(
  companyId: string,
  eventType: EmailEvent,
  userId?: string
): Promise<boolean> {
  const companyPref = await prisma.notificationTemplate.findFirst({
    where: { companyId, eventType },
  });

  if (companyPref && !companyPref.enabled) return false;

  if (userId) {
    const userPref = await prisma.userNotificationPreference.findFirst({
      where: { userId, companyId, eventType },
    });
    if (userPref && !userPref.enabled) return false;
  }

  return true;
}

/**
 * Send a notification email if the event is enabled for the company/user.
 */
export async function sendNotification(
  companyId: string,
  eventType: EmailEvent,
  params: SendEmailParams,
  userId?: string
): Promise<boolean> {
  const enabled = await isNotificationEnabled(companyId, eventType, userId);
  if (!enabled) return false;
  return sendEmail(params);
}

function wrapHtml(body: string, companyName?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,-apple-system,sans-serif;background-color:#f8fafc">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#3b82f6 100%);border-radius:12px;padding:24px 32px;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">${companyName || "SGC"}</h1>
    </div>
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
      ${body}
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px">
      Este es un email automático del Sistema de Gestión Comercial. No responder.
    </p>
  </div>
</body>
</html>`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(amount);
}

// ============================================
// EMAIL TEMPLATE FUNCTIONS
// ============================================

export function emailUserCreated(userName: string, userEmail: string, tempPassword: string, companyName: string): SendEmailParams {
  return {
    to: userEmail,
    toName: userName,
    subject: `Bienvenido a ${companyName} — Tu cuenta ha sido creada`,
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">¡Bienvenido, ${userName}!</h2>
      <p style="color:#475569;line-height:1.6">Tu cuenta ha sido creada exitosamente en <strong>${companyName}</strong>.</p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0">
        <p style="margin:0;color:#475569"><strong>Email:</strong> ${userEmail}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
      </div>
      <p style="color:#475569;line-height:1.6">Te recomendamos cambiar tu contraseña después de tu primer inicio de sesión.</p>
    `, companyName),
  };
}

export function emailPasswordReset(userName: string, userEmail: string, resetUrl: string): SendEmailParams {
  return {
    to: userEmail,
    toName: userName,
    subject: "Recuperación de contraseña — SGC",
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">Recuperación de contraseña</h2>
      <p style="color:#475569;line-height:1.6">Hola ${userName}, recibimos una solicitud para restablecer tu contraseña.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          Restablecer contraseña
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este email.</p>
    `),
  };
}

export function emailSaleCompleted(
  customerEmail: string, customerName: string,
  invoiceNumber: string, total: number, items: { name: string; qty: number; price: number }[],
  companyName: string
): SendEmailParams {
  const rows = items.map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${i.name}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${i.qty}</td>
     <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${formatCurrency(i.price)}</td></tr>`
  ).join("");

  return {
    to: customerEmail,
    toName: customerName,
    subject: `Factura ${invoiceNumber} — ${companyName}`,
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">Factura ${invoiceNumber}</h2>
      <p style="color:#475569;line-height:1.6">Hola ${customerName}, aquí tienes el detalle de tu compra:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Producto</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#475569">Cant.</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600;color:#475569">Precio</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:right;margin-top:16px">
        <p style="font-size:18px;font-weight:700;color:#1e293b;margin:0">Total: ${formatCurrency(total)}</p>
      </div>
    `, companyName),
  };
}

export function emailPurchaseCreated(
  userEmail: string, userName: string,
  purchaseNumber: string, supplierName: string, total: number, companyName: string
): SendEmailParams {
  return {
    to: userEmail,
    toName: userName,
    subject: `Orden de compra ${purchaseNumber} creada — ${companyName}`,
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">Orden de compra ${purchaseNumber}</h2>
      <p style="color:#475569;line-height:1.6">Se ha creado una nueva orden de compra:</p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0">
        <p style="margin:0;color:#475569"><strong>Proveedor:</strong> ${supplierName}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Total:</strong> ${formatCurrency(total)}</p>
      </div>
    `, companyName),
  };
}

export function emailPurchaseReceived(
  userEmail: string, userName: string,
  purchaseNumber: string, total: number, companyName: string
): SendEmailParams {
  return {
    to: userEmail,
    toName: userName,
    subject: `Compra ${purchaseNumber} recibida — ${companyName}`,
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">Compra recibida</h2>
      <p style="color:#475569;line-height:1.6">La orden de compra <strong>${purchaseNumber}</strong> ha sido recibida e ingresada al inventario.</p>
      <p style="color:#475569"><strong>Total:</strong> ${formatCurrency(total)}</p>
    `, companyName),
  };
}

export function emailMembershipCreated(
  customerEmail: string, customerName: string,
  planName: string, startDate: string, endDate: string, total: number, companyName: string
): SendEmailParams {
  return {
    to: customerEmail,
    toName: customerName,
    subject: `Membresía activada — ${companyName}`,
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">¡Membresía activada!</h2>
      <p style="color:#475569;line-height:1.6">Hola ${customerName}, tu membresía ha sido activada exitosamente.</p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0">
        <p style="margin:0;color:#475569"><strong>Plan:</strong> ${planName}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Inicio:</strong> ${startDate}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Vence:</strong> ${endDate}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Total:</strong> ${formatCurrency(total)}</p>
      </div>
    `, companyName),
  };
}

export function emailDayPassCreated(
  customerEmail: string, customerName: string,
  totalEntries: number, total: number, companyName: string
): SendEmailParams {
  return {
    to: customerEmail,
    toName: customerName,
    subject: `Tiquetera activada — ${companyName}`,
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">¡Tiquetera activada!</h2>
      <p style="color:#475569;line-height:1.6">Hola ${customerName}, tu tiquetera ha sido creada.</p>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0">
        <p style="margin:0;color:#475569"><strong>Entradas disponibles:</strong> ${totalEntries}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Total:</strong> ${formatCurrency(total)}</p>
      </div>
    `, companyName),
  };
}

export function emailCashSessionClosed(
  userEmail: string, userName: string,
  salesTotal: number, openingAmount: number, closingAmount: number,
  difference: number, companyName: string
): SendEmailParams {
  const diffColor = difference < 0 ? "#ef4444" : difference > 0 ? "#22c55e" : "#475569";
  return {
    to: userEmail,
    toName: userName,
    subject: `Cierre de caja — ${companyName}`,
    htmlContent: wrapHtml(`
      <h2 style="color:#1e293b;margin:0 0 16px">Cierre de caja</h2>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e2e8f0">
        <p style="margin:0;color:#475569"><strong>Apertura:</strong> ${formatCurrency(openingAmount)}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Ventas:</strong> ${formatCurrency(salesTotal)}</p>
        <p style="margin:8px 0 0;color:#475569"><strong>Cierre:</strong> ${formatCurrency(closingAmount)}</p>
        <p style="margin:8px 0 0;color:${diffColor};font-weight:600"><strong>Diferencia:</strong> ${formatCurrency(difference)}</p>
      </div>
    `, companyName),
  };
}
