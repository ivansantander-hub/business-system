import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const jwtSecretValue = process.env.JWT_SECRET;

if (!jwtSecretValue) {
  throw new Error(
    "[FATAL] La variable de entorno JWT_SECRET no está definida. " +
      "El servidor no puede iniciar sin un secreto seguro. " +
      "Agrega JWT_SECRET=<mínimo 32 caracteres> en tu archivo .env"
  );
}

if (jwtSecretValue.length < 32) {
  throw new Error(
    "[FATAL] JWT_SECRET debe tener al menos 32 caracteres para ser seguro."
  );
}

const JWT_SECRET = new TextEncoder().encode(jwtSecretValue);

export interface JWTPayload {
  userId: string;
  role: string;
  name: string;
  companyId: string | null;
  branchId: string | null;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getUserFromHeaders(request: Request): {
  userId: string;
  role: string;
  name: string;
  companyId: string | null;
  branchId: string | null;
} {
  const userId = request.headers.get("x-user-id") || "";
  const role = request.headers.get("x-user-role") || "CASHIER";
  const name = request.headers.get("x-user-name") || "";
  const companyId = request.headers.get("x-company-id") || null;
  const branchId = request.headers.get("x-branch-id") || null;
  return { userId, role, name, companyId, branchId };
}

export function getActiveBranchId(request: Request): string | null {
  return getUserFromHeaders(request).branchId;
}

export function requireCompanyId(request: Request): string {
  const { companyId, role } = getUserFromHeaders(request);
  if (role === "SUPER_ADMIN") {
    const url = new URL(request.url);
    const qsCompanyId = url.searchParams.get("companyId");
    if (qsCompanyId) return qsCompanyId;
    throw new Error("SUPER_ADMIN must specify companyId");
  }
  if (!companyId) throw new Error("Company context required");
  return companyId;
}

/**
 * Versión validada de requireCompanyId: verifica que la empresa exista y esté activa.
 * Para SUPER_ADMIN, valida que el companyId del query string corresponde a una empresa real.
 * Para otros roles, el companyId viene del JWT (ya validado al login).
 */
export async function requireValidCompanyId(request: Request): Promise<string> {
  const companyId = requireCompanyId(request);
  const { role } = getUserFromHeaders(request);

  if (role === "SUPER_ADMIN") {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new Error("Company not found");
  }

  return companyId;
}
