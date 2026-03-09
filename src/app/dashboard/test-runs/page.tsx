"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAtomValue } from "jotai";
import { PageHeader } from "@/components/molecules";
import {
  FlaskConical, ChevronRight, CheckCircle, XCircle,
  Image as ImageIcon, Clock, X, Maximize2, ArrowLeft, Play, Loader2
} from "lucide-react";
import { userRoleAtom } from "@/store";

interface TestRun {
  id: string;
  timestamp: string;
}

interface Screenshot {
  key: string;
  name: string;
  size: number;
}

interface RunDetail {
  runId: string;
  results: {
    passed: number;
    failed: number;
    errors: { name: string; error: string }[];
    screenshots: string[];
    timestamp?: string;
    total?: number;
  } | null;
  screenshots: Screenshot[];
}

function formatRunDate(id: string) {
  const parts = id.split("T");
  if (parts.length < 2) return id;
  const date = parts[0];
  const time = parts[1].replaceAll("-", ":");
  return `${date} ${time}`;
}

function getExecutionPanelTitle(status: ExecutionStatus | null) {
  if (!status) return "Ejecución de tests";
  if (status.running) {
    return (
      <>
        <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
        Ejecutando tests...
      </>
    );
  }
  if (status.completed) {
    const success = (status.exitCode ?? 0) === 0;
    return success ? (
      <>
        <CheckCircle className="w-5 h-5 text-emerald-500" />
        Tests completados correctamente
      </>
    ) : (
      <>
        <XCircle className="w-5 h-5 text-red-500" />
        Tests fallaron
      </>
    );
  }
  return "Ejecución de tests";
}

interface ExecutionStatus {
  running: boolean;
  output: string;
  startedAt?: string;
  completed?: boolean;
  exitCode?: number;
}

export default function TestRunsPage() {
  const userRole = useAtomValue(userRoleAtom);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null);
  const [executionStarting, setExecutionStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/test-runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const pollExecutionStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/test-runs/execute");
      if (res.ok) {
        const data = await res.json();
        setExecutionStatus(data);
        if (data.completed) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          loadRuns();
        }
      }
    } catch {
      // ignore
    }
  }, [loadRuns]);

  useEffect(() => {
    if (!executionPanelOpen || !executionStatus?.running) return;
    pollExecutionStatus();
    pollRef.current = setInterval(pollExecutionStatus, 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [executionPanelOpen, executionStatus?.running, pollExecutionStatus]);

  async function startExecution() {
    setExecutionStarting(true);
    try {
      const res = await fetch("/api/test-runs/execute", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setExecutionPanelOpen(true);
        setExecutionStatus({ running: true, output: "", startedAt: new Date().toISOString() });
      } else if (res.status === 409) {
        setExecutionPanelOpen(true);
        pollExecutionStatus();
      } else {
        setExecutionStatus({ running: false, output: data.error || "Error al iniciar", completed: true, exitCode: 1 });
        setExecutionPanelOpen(true);
      }
    } catch {
      setExecutionStatus({ running: false, output: "Error de conexión", completed: true, exitCode: 1 });
      setExecutionPanelOpen(true);
    } finally {
      setExecutionStarting(false);
    }
  }

  async function openRun(runId: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/test-runs?runId=${encodeURIComponent(runId)}`);
      if (res.ok) {
        setSelectedRun(await res.json());
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  if (selectedRun) {
    const r = selectedRun.results;
    const total = r ? (r.total || r.passed + r.failed) : 0;

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedRun(null)} className="btn-secondary p-2">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <PageHeader
              title={`Test Run: ${formatRunDate(selectedRun.runId)}`}
              subtitle={r ? `${r.passed} passed, ${r.failed} failed de ${total} tests` : "Sin resultados"}
              icon={<FlaskConical className="w-6 h-6" />}
            />
          </div>
          {userRole === "SUPER_ADMIN" && (
            <button
              onClick={startExecution}
              disabled={executionStarting}
              className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap shrink-0"
            >
              {executionStarting || executionStatus?.running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {executionStatus?.running ? "Ejecutando..." : "Iniciando..."}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Ejecutar Tests
                </>
              )}
            </button>
          )}
        </div>

        {r && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{total}</p>
              <p className="text-sm text-slate-500">Total Tests</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-emerald-600">{r.passed}</p>
              <p className="text-sm text-slate-500">Passed</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{r.failed}</p>
              <p className="text-sm text-slate-500">Failed</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-3xl font-bold text-violet-600">
                {total > 0 ? Math.round((r.passed / total) * 100) : 0}%
              </p>
              <p className="text-sm text-slate-500">Success Rate</p>
            </div>
          </div>
        )}

        {r && r.errors.length > 0 && (
          <div className="card">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Tests Fallidos ({r.errors.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {r.errors.map((e, i) => (
                <div key={i} className="p-4">
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{e.name}</p>
                  <p className="text-xs text-red-500 mt-1 font-mono">{e.error}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedRun.screenshots.length > 0 && (
          <div className="card">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Screenshots ({selectedRun.screenshots.length})
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedRun.screenshots.map((ss) => {
                const testName = ss.name
                  .replaceAll(".png", "")
                  .replaceAll("_", " ")
                  .replace(/^\d+-/, "");

                const imgUrl = `/api/test-runs/screenshot?key=${encodeURIComponent(ss.key)}`;
                const isPassed = r ? !r.errors.some((e) => ss.name.includes(e.name.replace(/\s/g, "_").slice(0, 40))) : true;

                return (
                  <div key={ss.key} className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div className="aspect-video bg-slate-100 dark:bg-slate-900 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt={testName}
                        className="w-full h-full object-cover object-top"
                        loading="lazy"
                      />
                      <button
                        onClick={() => setLightboxImg(imgUrl)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center gap-2">
                        {isPassed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate capitalize">
                          {testName}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{(ss.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {lightboxImg && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setLightboxImg(null)}
            onKeyDown={(e) => { if (e.key === "Escape") setLightboxImg(null); }}
          >
            <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-lg">
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxImg} alt="Screenshot" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        )}

        {executionPanelOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="execution-panel-title-detail"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70"
          >
            <div className="card w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <h2 id="execution-panel-title-detail" className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  {getExecutionPanelTitle(executionStatus)}
                </h2>
                <button
                  onClick={() => setExecutionPanelOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl min-h-[200px] max-h-[60vh] whitespace-pre-wrap break-words">
                {executionStatus?.output || "Esperando salida..."}
              </pre>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  onClick={() => setExecutionPanelOpen(false)}
                  className="btn-secondary w-full sm:w-auto"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Resultados de Tests"
          subtitle="Historial de ejecuciones de test E2E y sus screenshots"
          icon={<FlaskConical className="w-6 h-6" />}
        />
        {userRole === "SUPER_ADMIN" && (
          <button
            onClick={startExecution}
            disabled={executionStarting}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap shrink-0"
          >
            {executionStarting || executionStatus?.running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {executionStatus?.running ? "Ejecutando..." : "Iniciando..."}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Ejecutar Tests
              </>
            )}
          </button>
        )}
      </div>

      {loading && (
        <div className="card p-12 text-center text-slate-500">Cargando ejecuciones...</div>
      )}

      {!loading && runs.length === 0 && (
        <div className="card p-12 text-center text-slate-500">
          No hay ejecuciones de test guardadas en R2.
          <br />
          <span className="text-xs mt-2 block">Ejecuta los tests con <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">pnpm test:all</code> para generar resultados.</span>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => openRun(run.id)}
              disabled={loadingDetail}
              className="card p-4 text-left hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/10">
                  <FlaskConical className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {formatRunDate(run.id)}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> Test Run
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-500" />
              </div>
            </button>
          ))}
        </div>
      )}

      {executionPanelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="execution-panel-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70"
        >
          <div className="card w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <h2 id="execution-panel-title" className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  {getExecutionPanelTitle(executionStatus)}
                </h2>
              <button
                onClick={() => setExecutionPanelOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl min-h-[200px] max-h-[60vh] whitespace-pre-wrap break-words">
              {executionStatus?.output || "Esperando salida..."}
            </pre>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <button
                onClick={() => setExecutionPanelOpen(false)}
                className="btn-secondary w-full sm:w-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
