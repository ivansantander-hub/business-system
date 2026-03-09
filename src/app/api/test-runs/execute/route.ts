import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { getUserFromHeaders } from "@/lib/auth";

const CWD = String.raw`c:\ivan\personal\2026\business-system`;

interface ExecutionState {
  running: boolean;
  output: string;
  startedAt: string | null;
  exitCode: number | null;
  completed: boolean;
}

let executionState: ExecutionState = {
  running: false,
  output: "",
  startedAt: null,
  exitCode: null,
  completed: false,
};

/** POST — Start test execution. SUPER_ADMIN only. */
export async function POST(request: Request) {
  const { role } = getUserFromHeaders(request);

  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });
  }

  if (executionState.running) {
    return NextResponse.json(
      { error: "Ya hay una ejecución en curso" },
      { status: 409 }
    );
  }

  const executionId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  executionState = {
    running: true,
    output: "",
    startedAt: new Date().toISOString(),
    exitCode: null,
    completed: false,
  };

  const scriptPath = path.join(CWD, "scripts", "run-all-tests.js");
  const proc = spawn("node", [scriptPath], {
    shell: true,
    cwd: CWD,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (chunk: Buffer) => {
    executionState.output += chunk.toString();
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    executionState.output += chunk.toString();
  });

  proc.on("close", (code, signal) => {
    executionState.running = false;
    executionState.completed = true;
    executionState.exitCode = code ?? (signal ? 1 : 0);
  });

  proc.on("error", (err) => {
    executionState.output += `\n[ERROR] ${err.message}`;
    executionState.running = false;
    executionState.completed = true;
    executionState.exitCode = 1;
  });

  return NextResponse.json({ ok: true, executionId });
}

/** GET — Return current execution status. */
export async function GET(request: Request) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });
  }

  if (executionState.running) {
    return NextResponse.json({
      running: true,
      output: executionState.output,
      startedAt: executionState.startedAt,
    });
  }

  if (executionState.completed) {
    return NextResponse.json({
      running: false,
      completed: true,
      output: executionState.output,
      exitCode: executionState.exitCode ?? 0,
    });
  }

  return NextResponse.json({ running: false });
}
