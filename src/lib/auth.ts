import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-change-me"
);

export interface JWTPayload {
  userId: number;
  role: string;
  name: string;
  companyId: number | null;
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
  userId: number;
  role: string;
  name: string;
  companyId: number | null;
} {
  const userId = Number(request.headers.get("x-user-id") || "0");
  const role = request.headers.get("x-user-role") || "CASHIER";
  const name = request.headers.get("x-user-name") || "";
  const rawCompanyId = request.headers.get("x-company-id");
  const companyId = rawCompanyId ? Number(rawCompanyId) : null;
  return { userId, role, name, companyId };
}

export function requireCompanyId(request: Request): number {
  const { companyId, role } = getUserFromHeaders(request);
  if (role === "SUPER_ADMIN") {
    const url = new URL(request.url);
    const qsCompanyId = url.searchParams.get("companyId");
    if (qsCompanyId) return Number(qsCompanyId);
    throw new Error("SUPER_ADMIN must specify companyId");
  }
  if (!companyId) throw new Error("Company context required");
  return companyId;
}
