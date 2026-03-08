"use client";

import { useEffect, useState, useCallback } from "react";
import { UserCheck, LogIn, LogOut, Search, Clock, ShieldCheck, ShieldX } from "lucide-react";
import Toast from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";

interface CheckInRecord {
  id: string;
  timestamp: string;
  type: string;
  method: string;
  member: { customer: { name: string; nit: string | null } };
}

interface CheckInResult {
  accessGranted: boolean;
  reason: string;
  memberName?: string;
  method?: string;
  checkIn?: { member: { customer: { name: string } } };
}

export default function CheckInPage() {
  const [document, setDocument] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadCheckIns = useCallback(async () => {
    const res = await fetch("/api/checkins");
    if (res.ok) setCheckIns(await res.json());
  }, []);

  useEffect(() => { loadCheckIns(); }, [loadCheckIns]);

  async function handleAction(type: "ENTRY" | "EXIT") {
    if (!document.trim()) {
      setToast({ message: "Ingrese el número de documento", type: "error" });
      return;
    }
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: document.trim(), type }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.status === 201) {
      setResult({
        accessGranted: true,
        reason: data.reason,
        method: data.method,
        checkIn: data.checkIn,
      });
      setToast({
        message: type === "ENTRY" ? "Entrada registrada" : "Salida registrada",
        type: "success",
      });
      loadCheckIns();
      setTimeout(() => {
        setDocument("");
        setResult(null);
      }, 4000);
    } else if (res.status === 403) {
      setResult({
        accessGranted: false,
        reason: data.reason,
        memberName: data.memberName,
      });
    } else {
      setToast({ message: data.error || "Error al registrar", type: "error" });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAction("ENTRY");
    }
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex items-center gap-3">
        <UserCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control de Acceso</h1>
      </div>

      <div className="card max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Ingrese el documento del cliente</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Se validará automáticamente si tiene membresía o tiquetera activa</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 dark:text-gray-500" />
          <input
            className="input-field pl-14 text-2xl py-4 text-center font-mono tracking-wider"
            placeholder="Número de documento..."
            value={document}
            onChange={(e) => { setDocument(e.target.value); setResult(null); }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleAction("ENTRY")}
            disabled={loading || !document.trim()}
            className="btn-success flex items-center justify-center gap-3 py-5 text-xl disabled:opacity-50"
          >
            <LogIn className="w-7 h-7" />
            ENTRADA
          </button>
          <button
            onClick={() => handleAction("EXIT")}
            disabled={loading || !document.trim()}
            className="btn-danger flex items-center justify-center gap-3 py-5 text-xl disabled:opacity-50"
          >
            <LogOut className="w-7 h-7" />
            SALIDA
          </button>
        </div>

        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Validando...</p>
          </div>
        )}

        {result && (
          <div className={`rounded-xl p-6 text-center ${
            result.accessGranted
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700"
              : "bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700"
          }`}>
            {result.accessGranted ? (
              <>
                <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
                <p className="text-2xl font-bold text-emerald-700">ACCESO PERMITIDO</p>
                <p className="text-lg text-emerald-600 mt-1">
                  {result.checkIn?.member.customer.name}
                </p>
                <p className="text-sm text-emerald-500 mt-2">{result.reason}</p>
              </>
            ) : (
              <>
                <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-3" />
                <p className="text-2xl font-bold text-red-700">ACCESO DENEGADO</p>
                {result.memberName && (
                  <p className="text-lg text-red-600 mt-1">{result.memberName}</p>
                )}
                <p className="text-sm text-red-500 mt-2">{result.reason}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          Registros de hoy
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Hora</th>
                <th className="table-header">Documento</th>
                <th className="table-header">Nombre</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Método</th>
              </tr>
            </thead>
            <tbody>
              {checkIns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell">{formatDateTime(c.timestamp)}</td>
                  <td className="table-cell font-mono text-sm">{c.member.customer.nit || "-"}</td>
                  <td className="table-cell font-medium">{c.member.customer.name}</td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center gap-1 font-medium ${c.type === "ENTRY" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {c.type === "ENTRY" ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                      {c.type === "ENTRY" ? "Entrada" : "Salida"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.method === "MEMBERSHIP" ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" :
                      c.method === "DAY_PASS" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                      "bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400"
                    }`}>
                      {c.method === "MEMBERSHIP" ? "Membresía" : c.method === "DAY_PASS" ? "Tiquetera" : "Manual"}
                    </span>
                  </td>
                </tr>
              ))}
              {checkIns.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-gray-400 dark:text-gray-500 py-12">
                    Sin registros hoy
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
