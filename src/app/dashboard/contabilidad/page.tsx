"use client";

import { useEffect, useState, useCallback } from "react";
import { Calculator, Plus, BookOpen, Receipt } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Account { id: string; code: string; name: string; type: string; balance: string; }
interface JournalEntry {
  id: string; date: string; description: string; reference: string | null;
  lines: { id: string; debit: string; credit: string; description: string | null; account: { code: string; name: string } }[];
}
interface Expense { id: string; category: string; description: string; amount: string; date: string; paymentMethod: string; user: { name: string }; receiptNumber: string | null; }

type Tab = "accounts" | "journal" | "expenses";

export default function ContabilidadPage() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [journalForm, setJournalForm] = useState({ description: "", reference: "", date: new Date().toISOString().split("T")[0], lines: [{ accountId: "", debit: "", credit: "", description: "" }, { accountId: "", debit: "", credit: "", description: "" }] });
  const [expenseForm, setExpenseForm] = useState({ category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], paymentMethod: "CASH", receiptNumber: "", notes: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadAll = useCallback(async () => {
    const [accRes, jeRes, expRes] = await Promise.all([
      fetch("/api/accounting/accounts"),
      fetch("/api/accounting/journal"),
      fetch("/api/accounting/expenses"),
    ]);
    setAccounts(accRes.ok ? await accRes.json() : []);
    setEntries(jeRes.ok ? await jeRes.json() : []);
    setExpenses(expRes.ok ? await expRes.json() : []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function createJournalEntry(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/accounting/journal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(journalForm),
    });
    if (res.ok) { setShowJournalModal(false); loadAll(); setToast({ message: "Partida registrada", type: "success" }); }
    else { const data = await res.json(); setToast({ message: data.error || "Error", type: "error" }); }
  }

  async function createExpense(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/accounting/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expenseForm),
    });
    if (res.ok) { setShowExpenseModal(false); loadAll(); setToast({ message: "Gasto registrado", type: "success" }); }
  }

  const typeLabels: Record<string, string> = { ASSET: "Activo", LIABILITY: "Pasivo", EQUITY: "Patrimonio", INCOME: "Ingreso", EXPENSE: "Gasto" };
  const typeColors: Record<string, string> = { ASSET: "text-blue-600", LIABILITY: "text-red-600", EQUITY: "text-purple-600", INCOME: "text-emerald-600", EXPENSE: "text-amber-600" };
  const expenseCategories = ["Alquiler", "Servicios", "Salarios", "Suministros", "Transporte", "Publicidad", "Mantenimiento", "Otros"];

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "accounts", label: "Plan de Cuentas", icon: BookOpen },
    { key: "journal", label: "Diario", icon: Calculator },
    { key: "expenses", label: "Gastos", icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="page-header"><div className="page-icon"><Calculator className="w-full h-full" /></div><h1 className="page-title">Contabilidad</h1></div>
        <div className="flex gap-2">
          {tab === "journal" && <button onClick={() => setShowJournalModal(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Partida</button>}
          {tab === "expenses" && <button onClick={() => { setExpenseForm({ category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], paymentMethod: "CASH", receiptNumber: "", notes: "" }); setShowExpenseModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Gasto</button>}
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === t.key ? "bg-violet-600 text-white" : "bg-white text-slate-600 dark:text-slate-300 border hover:bg-slate-50 dark:hover:bg-white/[0.03]"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="table-header">Código</th><th className="table-header">Nombre</th><th className="table-header">Tipo</th><th className="table-header text-right">Saldo</th></tr></thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className={a.code.length <= 2 ? "bg-slate-50 font-semibold" : "hover:bg-slate-50"}>
                  <td className="table-cell font-mono">{a.code}</td>
                  <td className={`table-cell ${a.code.length <= 2 ? "font-bold" : ""}`} style={{ paddingLeft: `${(a.code.split(".").length - 1) * 20 + 16}px` }}>{a.name}</td>
                  <td className={`table-cell ${typeColors[a.type]}`}>{typeLabels[a.type]}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(a.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "journal" && (
        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="card">
              <div className="flex justify-between mb-3">
                <div><span className="font-semibold">{entry.description}</span>{entry.reference && <span className="text-slate-400 dark:text-slate-500 ml-2">Ref: {entry.reference}</span>}</div>
                <span className="text-sm text-slate-500">{formatDate(entry.date)}</span>
              </div>
              <table className="w-full">
                <thead><tr><th className="table-header">Cuenta</th><th className="table-header text-right">Debe</th><th className="table-header text-right">Haber</th></tr></thead>
                <tbody>
                  {entry.lines.map(l => (
                    <tr key={l.id}><td className="table-cell">{l.account.code} - {l.account.name}</td>
                      <td className="table-cell text-right">{Number(l.debit) > 0 ? formatCurrency(l.debit) : ""}</td>
                      <td className="table-cell text-right">{Number(l.credit) > 0 ? formatCurrency(l.credit) : ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {entries.length === 0 && <div className="card text-center text-slate-400 dark:text-slate-500 py-12">Sin partidas de diario</div>}
        </div>
      )}

      {tab === "expenses" && (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="table-header">Categoría</th><th className="table-header">Descripción</th><th className="table-header text-right">Monto</th><th className="table-header">Pago</th><th className="table-header">Fecha</th><th className="table-header">Usuario</th></tr></thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="table-cell"><span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{exp.category}</span></td>
                  <td className="table-cell">{exp.description}</td>
                  <td className="table-cell text-right font-semibold text-red-600">{formatCurrency(exp.amount)}</td>
                  <td className="table-cell">{exp.paymentMethod}</td>
                  <td className="table-cell">{formatDate(exp.date)}</td>
                  <td className="table-cell">{exp.user.name}</td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-slate-400 dark:text-slate-500 py-12">Sin gastos</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Journal entry modal */}
      <Modal open={showJournalModal} onClose={() => setShowJournalModal(false)} title="Nueva Partida de Diario" size="lg">
        <form onSubmit={createJournalEntry} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label><input type="date" className="input-field" value={journalForm.date} onChange={e => setJournalForm({...journalForm, date: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción *</label><input className="input-field" value={journalForm.description} onChange={e => setJournalForm({...journalForm, description: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Referencia</label><input className="input-field" value={journalForm.reference} onChange={e => setJournalForm({...journalForm, reference: e.target.value})} /></div>
          </div>
          <div>
            <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Líneas</h4>
            {journalForm.lines.map((line, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input-field flex-1" value={line.accountId} onChange={e => { const lines = [...journalForm.lines]; lines[i] = {...lines[i], accountId: e.target.value}; setJournalForm({...journalForm, lines}); }}>
                  <option value="">Cuenta...</option>{accounts.filter(a => a.code.split(".").length >= 3).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
                <input type="number" step="0.01" className="input-field w-32" placeholder="Debe" value={line.debit} onChange={e => { const lines = [...journalForm.lines]; lines[i] = {...lines[i], debit: e.target.value}; setJournalForm({...journalForm, lines}); }} />
                <input type="number" step="0.01" className="input-field w-32" placeholder="Haber" value={line.credit} onChange={e => { const lines = [...journalForm.lines]; lines[i] = {...lines[i], credit: e.target.value}; setJournalForm({...journalForm, lines}); }} />
              </div>
            ))}
            <button type="button" onClick={() => setJournalForm({...journalForm, lines: [...journalForm.lines, { accountId: "", debit: "", credit: "", description: "" }]})} className="text-violet-600 dark:text-violet-400 text-sm font-medium hover:underline">+ Agregar línea</button>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowJournalModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Registrar</button></div>
        </form>
      </Modal>

      {/* Expense modal */}
      <Modal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Registrar Gasto">
        <form onSubmit={createExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
              <select className="input-field" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} required>
                <option value="">Seleccionar...</option>{expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto *</label><input type="number" step="0.01" className="input-field" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} required /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fecha</label><input type="date" className="input-field" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Método de Pago</label>
              <select className="input-field" value={expenseForm.paymentMethod} onChange={e => setExpenseForm({...expenseForm, paymentMethod: e.target.value})}>
                <option value="CASH">Efectivo</option><option value="CARD">Tarjeta</option><option value="TRANSFER">Transferencia</option>
              </select></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción *</label><input className="input-field" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} required /></div>
          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No. Recibo</label><input className="input-field" value={expenseForm.receiptNumber} onChange={e => setExpenseForm({...expenseForm, receiptNumber: e.target.value})} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowExpenseModal(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Registrar</button></div>
        </form>
      </Modal>
    </div>
  );
}
