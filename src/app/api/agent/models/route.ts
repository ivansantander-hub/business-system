import { NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { AVAILABLE_MODELS } from "@/lib/agent/providers";

export async function GET(request: Request) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json({ models: AVAILABLE_MODELS });
}
