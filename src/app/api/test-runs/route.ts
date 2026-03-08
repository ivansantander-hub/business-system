import { NextResponse } from "next/server";
import { getUserFromHeaders } from "@/lib/auth";
import { isR2Configured, listR2, getBufferFromR2 } from "@/lib/r2";

/** GET — List test runs or a specific run's details from R2. SUPER_ADMIN only. */
export async function GET(request: Request) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 no configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    const { prefixes } = await listR2("test-logs/", "/");

    const runs = prefixes
      .map((p) => {
        const id = p.replace("test-logs/", "").replace(/\/$/, "");
        return { id, timestamp: id.replace(/T/g, " ").replace(/-/g, (m, i) => (i > 9 ? ":" : m)) };
      })
      .sort((a, b) => b.id.localeCompare(a.id));

    return NextResponse.json({ runs });
  }

  const prefix = `test-logs/${runId}/`;
  const { objects } = await listR2(prefix);

  const resultsObj = objects.find((o) => o.key.endsWith("results.json"));
  let results = null;
  if (resultsObj) {
    const buf = await getBufferFromR2(resultsObj.key);
    if (buf) results = JSON.parse(buf.buffer.toString("utf-8"));
  }

  const screenshots = objects
    .filter((o) => o.key.endsWith(".png"))
    .map((o) => ({
      key: o.key,
      name: o.key.split("/").pop() || "",
      size: o.size,
    }));

  return NextResponse.json({ runId, results, screenshots });
}
