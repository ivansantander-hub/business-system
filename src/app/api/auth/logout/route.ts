import { NextResponse } from "next/server";
import { auditApiRequest } from "@/lib/api-audit";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("token");
  auditApiRequest(request, "auth.logout");
  return response;
}
