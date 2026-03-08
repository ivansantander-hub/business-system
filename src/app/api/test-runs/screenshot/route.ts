import { NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { isR2Configured, getBufferFromR2 } from "@/lib/r2";

/** GET — Serve a test screenshot from R2. SUPER_ADMIN only. */
export async function GET(request: Request) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 no configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || !key.startsWith("test-logs/")) {
    return NextResponse.json({ error: "Key inválida" }, { status: 400 });
  }

  const result = await getBufferFromR2(key);
  if (!result) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
