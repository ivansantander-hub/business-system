"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, TrendingUp, Package, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";

type ReportType = "sales" | "inventory" | "income-expense" | "top-products";

const COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function ReportesPage() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ type: reportType });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const res = await fetch(`/api/reports?${params}`);
    if (res.ok) {
      setData(await res.json());
    } else {
      setData(null);
    }
  }, [reportType, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const reports: { key: ReportType; label: string; icon: React.ElementType }[] = [
    { key: "sales", label: "Ventas", icon: TrendingUp },
    { key: "inventory", label: "Inventario", icon: Package },
    { key: "income-expense", label: "Ingresos vs Gastos", icon: DollarSign },
    { key: "top-products", label: "Top Productos", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {reports.map(r => (
          <button key={r.key} onClick={() => setReportType(r.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${reportType === r.key ? "bg-indigo-600 text-white" : "bg-white text-gray-600 dark:text-gray-300 border hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}>
            <r.icon className="w-4 h-4" /> {r.label}
          </button>
        ))}
      </div>

      {reportType !== "inventory" && (
        <div className="flex gap-3 items-center">
          <input type="date" className="input-field w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-gray-400 dark:text-gray-500">a</span>
          <input type="date" className="input-field w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      )}

      {!data ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {reportType === "sales" && (() => {
            const d = data as { summary: { total: number; tax: number; count: number }; invoices: { id: string; number: string; total: string; date: string; customer: { name: string } | null }[] };
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="card"><p className="text-sm text-gray-500">Total Ventas</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(d.summary.total)}</p></div>
                  <div className="card"><p className="text-sm text-gray-500">IVA Generado</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(d.summary.tax)}</p></div>
                  <div className="card"><p className="text-sm text-gray-500">Transacciones</p><p className="text-2xl font-bold text-gray-900">{d.summary.count}</p></div>
                </div>
                <div className="card overflow-x-auto">
                  <table className="w-full"><thead><tr><th className="table-header">Factura</th><th className="table-header">Cliente</th><th className="table-header text-right">Total</th><th className="table-header">Fecha</th></tr></thead>
                    <tbody>{d.invoices.map(inv => (<tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="table-cell font-medium">{inv.number}</td><td className="table-cell">{inv.customer?.name || "C/F"}</td><td className="table-cell text-right font-semibold">{formatCurrency(inv.total)}</td><td className="table-cell">{formatDate(inv.date)}</td></tr>))}</tbody></table>
                </div>
              </div>
            );
          })()}

          {reportType === "inventory" && (() => {
            const d = data as { summary: { totalProducts: number; totalValue: number; totalSaleValue: number }; products: { id: string; name: string; stock: string; costPrice: string; salePrice: string; category: { name: string } | null }[] };
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="card"><p className="text-sm text-gray-500">Total Productos</p><p className="text-2xl font-bold text-gray-900">{d.summary.totalProducts}</p></div>
                  <div className="card"><p className="text-sm text-gray-500">Valor al Costo</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(d.summary.totalValue)}</p></div>
                  <div className="card"><p className="text-sm text-gray-500">Valor a Venta</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(d.summary.totalSaleValue)}</p></div>
                </div>
                <div className="card overflow-x-auto">
                  <table className="w-full"><thead><tr><th className="table-header">Producto</th><th className="table-header">Categoría</th><th className="table-header text-right">Stock</th><th className="table-header text-right">Costo</th><th className="table-header text-right">Precio</th><th className="table-header text-right">Valor</th></tr></thead>
                    <tbody>{(d.products || []).map(p => (<tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="table-cell font-medium">{p.name}</td><td className="table-cell">{p.category?.name || "-"}</td><td className="table-cell text-right">{Number(p.stock).toFixed(0)}</td><td className="table-cell text-right">{formatCurrency(p.costPrice)}</td><td className="table-cell text-right">{formatCurrency(p.salePrice)}</td><td className="table-cell text-right font-semibold">{formatCurrency(Number(p.stock) * Number(p.salePrice))}</td></tr>))}</tbody></table>
                </div>
              </div>
            );
          })()}

          {reportType === "income-expense" && (() => {
            const d = data as { totalIncome: number; totalExpenses: number; profit: number; expensesByCategory: { category: string; _sum: { amount: number } }[] };
            const chartData = (d.expensesByCategory || []).map(e => ({ name: e.category, value: Number(e._sum.amount) }));
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="card"><p className="text-sm text-gray-500">Ingresos</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(d.totalIncome)}</p></div>
                  <div className="card"><p className="text-sm text-gray-500">Gastos</p><p className="text-2xl font-bold text-red-600">{formatCurrency(d.totalExpenses)}</p></div>
                  <div className="card"><p className="text-sm text-gray-500">Utilidad</p><p className={`text-2xl font-bold ${d.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(d.profit)}</p></div>
                </div>
                {chartData.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Gastos por Categoría</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}

          {reportType === "top-products" && (() => {
            const d = data as { productName: string; _sum: { quantity: number; total: number } }[];
            const chartData = d.map(p => ({ name: p.productName, total: Number(p._sum.total), qty: Number(p._sum.quantity) }));
            return (
              <div className="space-y-4">
                <div className="card">
                  <h3 className="font-semibold mb-4">Productos Más Vendidos</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} /><Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card overflow-x-auto">
                  <table className="w-full"><thead><tr><th className="table-header">Producto</th><th className="table-header text-right">Cantidad</th><th className="table-header text-right">Total</th></tr></thead>
                    <tbody>{d.map((p, i) => (<tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="table-cell font-medium">{p.productName}</td><td className="table-cell text-right">{Number(p._sum.quantity).toFixed(0)}</td><td className="table-cell text-right font-semibold">{formatCurrency(p._sum.total)}</td></tr>))}</tbody></table>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
