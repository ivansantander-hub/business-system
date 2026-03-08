"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, ShoppingCart, AlertTriangle, ClipboardList, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DashboardData {
  todaySales: number;
  todayTransactions: number;
  openOrders: number;
  lowStockCount: number;
  salesByDay: { date: string; total: number }[];
  recentInvoices: { id: number; number: string; total: string; date: string; customer: { name: string } | null }[];
  lowStockProducts: { id: number; name: string; stock: string; min_stock: string }[];
}

const emptyData: DashboardData = {
  todaySales: 0,
  todayTransactions: 0,
  openOrders: 0,
  lowStockCount: 0,
  salesByDay: [],
  recentInvoices: [],
  lowStockProducts: [],
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports?type=dashboard");
      if (!res.ok) {
        setData(emptyData);
        setError(res.status === 403 ? "Sin acceso a datos de empresa" : "Error al cargar datos");
        return;
      }
      const json = await res.json();
      setData({
        todaySales: json.todaySales ?? 0,
        todayTransactions: json.todayTransactions ?? 0,
        openOrders: json.openOrders ?? 0,
        lowStockCount: json.lowStockCount ?? 0,
        salesByDay: json.salesByDay ?? [],
        recentInvoices: json.recentInvoices ?? [],
        lowStockProducts: json.lowStockProducts ?? [],
      });
    } catch {
      setData(emptyData);
      setError("Error de conexión");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>;

  const cards = [
    { label: "Ventas Hoy", value: formatCurrency(data.todaySales), icon: DollarSign, color: "bg-emerald-500" },
    { label: "Transacciones", value: data.todayTransactions, icon: ShoppingCart, color: "bg-blue-500" },
    { label: "Órdenes Abiertas", value: data.openOrders, icon: ClipboardList, color: "bg-amber-500" },
    { label: "Stock Bajo", value: data.lowStockCount, icon: AlertTriangle, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card flex items-center gap-4">
            <div className={`${card.color} p-3 rounded-xl`}>
              <card.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Ventas - Últimos 7 días</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.salesByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), "Ventas"]} />
              <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900">Alertas de Stock Bajo</h2>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No hay alertas de stock bajo</p>
          ) : (
            <div className="space-y-2">
              {data.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{p.name}</span>
                  <span className="text-sm text-red-600 font-semibold">
                    {Number(p.stock).toFixed(0)} / {Number(p.min_stock).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Ventas Recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Factura</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Total</th>
                <th className="table-header">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.recentInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="table-cell font-medium">{inv.number}</td>
                  <td className="table-cell">{inv.customer?.name || "Consumidor Final"}</td>
                  <td className="table-cell font-semibold">{formatCurrency(Number(inv.total))}</td>
                  <td className="table-cell">{formatDate(inv.date)}</td>
                </tr>
              ))}
              {data.recentInvoices.length === 0 && (
                <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">Sin ventas recientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
