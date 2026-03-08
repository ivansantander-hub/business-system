"use client";

import { useEffect, useState, useCallback } from "react";
import { Calculator, Plus, BookOpen, Receipt, Scale, BarChart3, Sigma } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { Button } from "@/components/atoms";
import { PageHeader, EmptyState } from "@/components/molecules";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Account { id: string; code: string; name: string; type: string; balance: string; }
interface JournalEntry {
  id: string; date: string; description: string; reference: string | null;
  lines: { id: string; debit: string; credit: string; description: string | null; account: { code: string; name: string } }[];
}
interface Expense { id: string; category: string; description: string; amount: string; date: string; paymentMethod: string; user: { name: string }; receiptNumber: string | null; }
interface BalanceSheetData {
  assets: { id: string; code: string; name: string; balance: number }[];
  liabilities: { id: string; code: string; name: string; balance: number }[];
  equity: { id: string; code: string; name: string; balance: number }[];
  totals: { totalAssets: number; totalLiabilities: number; totalEquity: number; totalLiabilitiesAndEquity: number; balanced: boolean };
}
interface IncomeStatementData {
  income: { id: string; code: string; name: string; balance: number }[];
  costOfSales: { id: string; code: string; name: string; balance: number }[];
  expenses: { id: string; code: string; name: string; balance: number }[];
  totals: { totalIncome: number; totalCostOfSales: number; grossProfit: number; totalExpenses: number; netIncome: number };
}
interface TrialBalanceData {
  accounts: { id: string; code: string; name: string; type: string; debitTotal: number; creditTotal: number; balance: number }[];
  totals: { totalDebits: number; totalCredits: number; balanced: boolean };
}

type Tab = "accounts" | "journal" | "expenses" | "balance-sheet" | "income-statement" | "trial-balance";

export default function ContabilidadPage() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementData | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [journalForm, setJournalForm] = useState({ description: "", reference: "", date: new Date().toISOString().split("T")[0], lines: [{ accountId: "", debit: "", credit: "", description: "" }, { accountId: "", debit: "", credit: "", description: "" }] });
  const [expenseForm, setExpenseForm] = useState({ category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], paymentMethod: "CASH", receiptNumber: "", notes: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadAll = useCallback(async () => {
    const [accRes, jeRes, expRes, bsRes, isRes, tbRes] = await Promise.all([
      fetch("/api/accounting/accounts"),
      fetch("/api/accounting/journal"),
      fetch("/api/accounting/expenses"),
      fetch("/api/accounting/balance-sheet"),
      fetch("/api/accounting/income-statement"),
      fetch("/api/accounting/trial-balance"),
    ]);
    setAccounts(accRes.ok ? await accRes.json() : []);
    setEntries(jeRes.ok ? await jeRes.json() : []);
    setExpenses(expRes.ok ? await expRes.json() : []);
    setBalanceSheet(bsRes.ok ? await bsRes.json() : null);
    setIncomeStatement(isRes.ok ? await isRes.json() : null);
    setTrialBalance(tbRes.ok ? await tbRes.json() : null);
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

  const typeLabels: Record<string, string> = { ASSET: "Activo", LIABILITY: "Pasivo", EQUITY: "Patrimonio", INCOME: "Ingreso", EXPENSE: "Gasto", COST: "Costo" };
  const typeColors: Record<string, string> = { ASSET: "text-blue-600 dark:text-blue-400", LIABILITY: "text-red-600 dark:text-red-400", EQUITY: "text-purple-600 dark:text-purple-400", INCOME: "text-emerald-600 dark:text-emerald-400", EXPENSE: "text-amber-600 dark:text-amber-400" };
  const expenseCategories = ["Alquiler", "Servicios", "Salarios", "Suministros", "Transporte", "Publicidad", "Mantenimiento", "Otros"];

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "accounts", label: "Plan de Cuentas", icon: BookOpen },
    { key: "journal", label: "Diario", icon: Calculator },
    { key: "expenses", label: "Gastos", icon: Receipt },
    { key: "balance-sheet", label: "Balance General", icon: Scale },
    { key: "income-statement", label: "Estado de Resultados", icon: BarChart3 },
    { key: "trial-balance", label: "Balance de Prueba", icon: Sigma },
  ];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader
        icon={<Calculator className="w-full h-full" />}
        title="Contabilidad"
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            {tab === "journal" && <Button onClick={() => setShowJournalModal(true)} icon={<Plus className="w-4 h-4" />}>Nueva Partida</Button>}
            {tab === "expenses" && <Button onClick={() => { setExpenseForm({ category: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], paymentMethod: "CASH", receiptNumber: "", notes: "" }); setShowExpenseModal(true); }} icon={<Plus className="w-4 h-4" />}>Nuevo Gasto</Button>}
          </div>
        }
      />

      <div className="flex overflow-x-auto gap-1 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === t.key ? "bg-violet-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/[0.03]"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <div className="card w-full">
          {accounts.length === 0 ? (
            <EmptyState icon={<BookOpen className="w-8 h-8" />} title="Sin cuentas" description="El plan de cuentas está vacío" />
          ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[600px]">
            <thead><tr><th className="table-header">Código</th><th className="table-header">Nombre</th><th className="table-header">Tipo</th><th className="table-header text-right">Saldo</th></tr></thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className={a.code.length <= 2 ? "bg-slate-50 dark:bg-white/[0.03] font-semibold" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"}>
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
        </div>
      )}

      {tab === "journal" && (
        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="card w-full">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2 mb-3">
                <div><span className="font-semibold">{entry.description}</span>{entry.reference && <span className="text-slate-400 dark:text-slate-500 ml-2">Ref: {entry.reference}</span>}</div>
                <span className="text-sm text-slate-500 dark:text-slate-400">{formatDate(entry.date)}</span>
              </div>
              <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-0">
              <table className="w-full min-w-[400px]">
                <thead><tr><th className="table-header">Cuenta</th><th className="table-header text-right">Debe</th><th className="table-header text-right">Haber</th></tr></thead>
                <tbody>
                  {entry.lines.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]"><td className="table-cell">{l.account.code} - {l.account.name}</td>
                      <td className="table-cell text-right">{Number(l.debit) > 0 ? formatCurrency(l.debit) : ""}</td>
                      <td className="table-cell text-right">{Number(l.credit) > 0 ? formatCurrency(l.credit) : ""}</td></tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ))}
          {entries.length === 0 && <div className="card w-full"><EmptyState icon={<Calculator className="w-8 h-8" />} title="Sin partidas de diario" description="Registra tu primera partida" /></div>}
        </div>
      )}

      {tab === "expenses" && (
        <div className="card w-full">
          {expenses.length === 0 ? (
            <EmptyState icon={<Receipt className="w-8 h-8" />} title="Sin gastos" description="Registra tu primer gasto" />
          ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[600px]">
            <thead><tr><th className="table-header">Categoría</th><th className="table-header">Descripción</th><th className="table-header text-right">Monto</th><th className="table-header">Pago</th><th className="table-header">Fecha</th><th className="table-header">Usuario</th></tr></thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="table-cell"><span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{exp.category}</span></td>
                  <td className="table-cell">{exp.description}</td>
                  <td className="table-cell text-right font-semibold text-red-600 dark:text-red-400">{formatCurrency(exp.amount)}</td>
                  <td className="table-cell">{exp.paymentMethod}</td>
                  <td className="table-cell">{formatDate(exp.date)}</td>
                  <td className="table-cell">{exp.user.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>
      )}

      {tab === "balance-sheet" && (
        <div className="card w-full">
          {balanceSheet ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-3">Activos</h3>
                  <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-0">
                    <table className="w-full min-w-[300px]">
                      <thead><tr><th className="table-header">Código</th><th className="table-header">Cuenta</th><th className="table-header text-right">Saldo</th></tr></thead>
                      <tbody>
                        {balanceSheet.assets.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                            <td className="table-cell font-mono">{a.code}</td>
                            <td className="table-cell">{a.name}</td>
                            <td className="table-cell text-right font-medium">{formatCurrency(a.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold"><td className="table-cell pt-2" colSpan={2}>Total Activos</td><td className="table-cell text-right pt-2">{formatCurrency(balanceSheet.totals.totalAssets)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">Pasivos</h3>
                  <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-0">
                    <table className="w-full min-w-[300px]">
                      <thead><tr><th className="table-header">Código</th><th className="table-header">Cuenta</th><th className="table-header text-right">Saldo</th></tr></thead>
                      <tbody>
                        {balanceSheet.liabilities.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                            <td className="table-cell font-mono">{a.code}</td>
                            <td className="table-cell">{a.name}</td>
                            <td className="table-cell text-right font-medium">{formatCurrency(a.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold"><td className="table-cell pt-2" colSpan={2}>Total Pasivos</td><td className="table-cell text-right pt-2">{formatCurrency(balanceSheet.totals.totalLiabilities)}</td></tr></tfoot>
                    </table>
                  </div>
                  <h3 className="text-lg font-semibold text-purple-600 dark:text-purple-400 mt-4 mb-3">Patrimonio</h3>
                  <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-0">
                    <table className="w-full min-w-[300px]">
                      <thead><tr><th className="table-header">Código</th><th className="table-header">Cuenta</th><th className="table-header text-right">Saldo</th></tr></thead>
                      <tbody>
                        {balanceSheet.equity.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                            <td className="table-cell font-mono">{a.code}</td>
                            <td className="table-cell">{a.name}</td>
                            <td className="table-cell text-right font-medium">{formatCurrency(a.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold"><td className="table-cell pt-2" colSpan={2}>Total Patrimonio</td><td className="table-cell text-right pt-2">{formatCurrency(balanceSheet.totals.totalEquity)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${balanceSheet.totals.balanced ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"}`}>
                    {balanceSheet.totals.balanced ? "Balance cuadra" : "Balance no cuadra"}
                  </span>
                </div>
                <div className="flex gap-6 text-sm">
                  <span>Activos: <strong>{formatCurrency(balanceSheet.totals.totalAssets)}</strong></span>
                  <span>Pasivos + Patrimonio: <strong>{formatCurrency(balanceSheet.totals.totalLiabilitiesAndEquity)}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<Scale className="w-8 h-8" />} title="Cargando..." description="Obteniendo balance general" />
          )}
        </div>
      )}

      {tab === "income-statement" && (
        <div className="card w-full">
          {incomeStatement ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-3">Ingresos</h3>
                  <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-0">
                    <table className="w-full min-w-[280px]">
                      <thead><tr><th className="table-header">Código</th><th className="table-header">Cuenta</th><th className="table-header text-right">Saldo</th></tr></thead>
                      <tbody>
                        {incomeStatement.income.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                            <td className="table-cell font-mono">{a.code}</td>
                            <td className="table-cell">{a.name}</td>
                            <td className="table-cell text-right font-medium">{formatCurrency(a.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold"><td className="table-cell pt-2" colSpan={2}>Total Ingresos</td><td className="table-cell text-right pt-2 text-emerald-600 dark:text-emerald-400">{formatCurrency(incomeStatement.totals.totalIncome)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-3">Costo de Ventas</h3>
                  <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-0">
                    <table className="w-full min-w-[280px]">
                      <thead><tr><th className="table-header">Código</th><th className="table-header">Cuenta</th><th className="table-header text-right">Saldo</th></tr></thead>
                      <tbody>
                        {incomeStatement.costOfSales.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                            <td className="table-cell font-mono">{a.code}</td>
                            <td className="table-cell">{a.name}</td>
                            <td className="table-cell text-right font-medium">{formatCurrency(a.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold"><td className="table-cell pt-2" colSpan={2}>Total Costo de Ventas</td><td className="table-cell text-right pt-2 text-orange-600 dark:text-orange-400">{formatCurrency(incomeStatement.totals.totalCostOfSales)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-3">Gastos</h3>
                  <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-0">
                    <table className="w-full min-w-[280px]">
                      <thead><tr><th className="table-header">Código</th><th className="table-header">Cuenta</th><th className="table-header text-right">Saldo</th></tr></thead>
                      <tbody>
                        {incomeStatement.expenses.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                            <td className="table-cell font-mono">{a.code}</td>
                            <td className="table-cell">{a.name}</td>
                            <td className="table-cell text-right font-medium">{formatCurrency(a.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold"><td className="table-cell pt-2" colSpan={2}>Total Gastos</td><td className="table-cell text-right pt-2 text-amber-600 dark:text-amber-400">{formatCurrency(incomeStatement.totals.totalExpenses)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="card bg-slate-50 dark:bg-white/[0.03]">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ingresos</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(incomeStatement.totals.totalIncome)}</p>
                </div>
                <div className="card bg-slate-50 dark:bg-white/[0.03]">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Utilidad Bruta</p>
                  <p className="text-xl font-bold">{formatCurrency(incomeStatement.totals.grossProfit)}</p>
                </div>
                <div className="card bg-slate-50 dark:bg-white/[0.03]">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Gastos</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(incomeStatement.totals.totalExpenses)}</p>
                </div>
                <div className="card bg-slate-50 dark:bg-white/[0.03]">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Utilidad Neta</p>
                  <p className={`text-xl font-bold ${incomeStatement.totals.netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(incomeStatement.totals.netIncome)}</p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="Cargando..." description="Obteniendo estado de resultados" />
          )}
        </div>
      )}

      {tab === "trial-balance" && (
        <div className="card w-full">
          {trialBalance === null ? (
            <EmptyState icon={<Sigma className="w-8 h-8" />} title="Cargando..." description="Obteniendo balance de prueba" />
          ) : trialBalance.accounts.length === 0 ? (
            <EmptyState icon={<Sigma className="w-8 h-8" />} title="Sin cuentas" description="No hay cuentas con movimientos para el balance de prueba" />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
                <table className="w-full min-w-[600px]">
                  <thead><tr><th className="table-header">Código</th><th className="table-header">Cuenta</th><th className="table-header">Tipo</th><th className="table-header text-right">Débitos</th><th className="table-header text-right">Créditos</th><th className="table-header text-right">Saldo</th></tr></thead>
                  <tbody>
                    {trialBalance.accounts.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                        <td className="table-cell font-mono">{a.code}</td>
                        <td className="table-cell">{a.name}</td>
                        <td className={`table-cell ${typeColors[a.type]}`}>{typeLabels[a.type]}</td>
                        <td className="table-cell text-right">{a.debitTotal > 0 ? formatCurrency(a.debitTotal) : ""}</td>
                        <td className="table-cell text-right">{a.creditTotal > 0 ? formatCurrency(a.creditTotal) : ""}</td>
                        <td className={`table-cell text-right font-medium ${a.balance >= 0 ? "" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(Math.abs(a.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold bg-slate-50 dark:bg-white/[0.03]">
                      <td className="table-cell pt-3" colSpan={3}>Totales</td>
                      <td className="table-cell text-right pt-3">{formatCurrency(trialBalance.totals.totalDebits)}</td>
                      <td className="table-cell text-right pt-3">{formatCurrency(trialBalance.totals.totalCredits)}</td>
                      <td className="table-cell pt-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${trialBalance.totals.balanced ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"}`}>
                  {trialBalance.totals.balanced ? "Débitos = Créditos (cuadra)" : "Débitos ≠ Créditos (no cuadra)"}
                </span>
              </div>
            </div>
          )}
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
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3"><Button type="button" variant="secondary" onClick={() => setShowJournalModal(false)}>Cancelar</Button><Button type="submit">Registrar</Button></div>
        </form>
      </Modal>

      {/* Expense modal */}
      <Modal open={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Registrar Gasto">
        <form onSubmit={createExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría *</label>
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
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3"><Button type="button" variant="secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</Button><Button type="submit">Registrar</Button></div>
        </form>
      </Modal>
    </div>
  );
}
