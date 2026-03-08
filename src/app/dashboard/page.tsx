"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, ShoppingCart, AlertTriangle, ClipboardList, TrendingUp, Users, UserCheck, Dumbbell, Ticket, CalendarClock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Spinner } from "@/components/atoms";
import { PageHeader, StatCard, EmptyState } from "@/components/molecules";

interface DashboardData {
  companyType: string;
  todaySales: number;
  todayTransactions: number;
  openOrders?: number;
  lowStockCount: number;
  salesByDay: { date: string; total: number }[];
  recentInvoices: { id: string; number: string; total: string; date: string; customer: { name: string } | null }[];
  lowStockProducts: { id: string; name: string; stock: string; min_stock: string }[];
  gym?: {
    totalMembers: number;
    activeMembers: number;
    todayCheckIns: number;
    activeMemberships: number;
    activeDayPasses: number;
    expiringMemberships: { id: string; memberName: string; planName: string; endDate: string }[];
    checkInsByDay: { date: string; entries: number }[];
  };
}

const emptyData: DashboardData = {
  companyType: "RESTAURANT",
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
        companyType: json.companyType ?? "RESTAURANT",
        todaySales: json.todaySales ?? 0,
        todayTransactions: json.todayTransactions ?? 0,
        openOrders: json.openOrders ?? 0,
        lowStockCount: json.lowStockCount ?? 0,
        salesByDay: json.salesByDay ?? [],
        recentInvoices: json.recentInvoices ?? [],
        lowStockProducts: json.lowStockProducts ?? [],
        gym: json.gym ?? undefined,
      });
    } catch {
      setData(emptyData);
      setError("Error de conexión");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <Spinner />
    </div>
  );

  const isGym = data.companyType === "GYM";

  const gymCards = isGym && data.gym ? [
    { label: "Ventas Hoy", value: formatCurrency(data.todaySales), icon: DollarSign, gradient: "from-emerald-500 to-emerald-600" },
    { label: "Miembros Activos", value: String(data.gym.activeMembers), icon: Users, gradient: "from-violet-500 to-indigo-600" },
    { label: "Entradas Hoy", value: String(data.gym.todayCheckIns), icon: UserCheck, gradient: "from-blue-500 to-blue-600" },
    { label: "Membresías Activas", value: String(data.gym.activeMemberships), icon: Dumbbell, gradient: "from-purple-500 to-purple-600" },
    { label: "Tiqueteras Activas", value: String(data.gym.activeDayPasses), icon: Ticket, gradient: "from-amber-500 to-orange-600" },
    { label: "Total Miembros", value: String(data.gym.totalMembers), icon: Users, gradient: "from-slate-500 to-slate-600" },
  ] : [];

  const restaurantCards = [
    { label: "Ventas Hoy", value: formatCurrency(data.todaySales), icon: DollarSign, gradient: "from-emerald-500 to-emerald-600" },
    { label: "Transacciones", value: String(data.todayTransactions), icon: ShoppingCart, gradient: "from-blue-500 to-blue-600" },
    { label: "Órdenes Abiertas", value: String(data.openOrders ?? 0), icon: ClipboardList, gradient: "from-amber-500 to-orange-600" },
    { label: "Stock Bajo", value: String(data.lowStockCount), icon: AlertTriangle, gradient: "from-red-500 to-red-600" },
  ];

  const cards = isGym ? gymCards : restaurantCards;

  const chartColors = {
    bar: "#7c3aed",
    barGym: "#10b981",
    grid: "var(--chart-grid, #f1f5f9)",
    text: "var(--chart-text, #64748b)",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader icon={<TrendingUp className="w-full h-full" />} title={isGym ? "Dashboard del Gimnasio" : "Dashboard"} />

      {error && (
        <div className="bg-amber-50 border border-amber-200/80 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isGym ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
        {cards.map((card, idx) => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={<card.icon className="w-5 h-5 text-white" />} gradient={card.gradient} accent={idx === 0} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isGym && data.gym ? (
          <>
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <UserCheck className="w-5 h-5 text-violet-500" aria-hidden="true" />
                <h2 className="section-title">Entradas &mdash; Últimos 7 Días</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.gym.checkInsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [value, "Entradas"]}
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="entries" fill={chartColors.bar} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <CalendarClock className="w-5 h-5 text-amber-500" aria-hidden="true" />
                <h2 className="section-title">Membresías por Vencer (7 Días)</h2>
              </div>
              {data.gym.expiringMemberships.length === 0 ? (
                <p className="text-sm text-muted py-12 text-center">No hay membresías próximas a vencer</p>
              ) : (
                <div className="space-y-2">
                  {data.gym.expiringMemberships.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2.5 px-4 bg-amber-50 dark:bg-amber-500/[0.06] rounded-xl border border-amber-100 dark:border-amber-500/10">
                      <div>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.memberName}</span>
                        <span className="text-xs text-muted ml-2">({m.planName})</span>
                      </div>
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatDate(m.endDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <TrendingUp className="w-5 h-5 text-violet-500" aria-hidden="true" />
                <h2 className="section-title">Ventas &mdash; Últimos 7 Días</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Ventas"]}
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="total" fill={chartColors.bar} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="flex items-center gap-2.5 mb-5">
                <AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden="true" />
                <h2 className="section-title">Alertas de Stock Bajo</h2>
              </div>
              {data.lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted py-12 text-center">No hay alertas de stock bajo</p>
              ) : (
                <div className="space-y-2">
                  {data.lowStockProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 px-4 bg-amber-50 dark:bg-amber-500/[0.06] rounded-xl border border-amber-100 dark:border-amber-500/10">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                      <span className="text-sm text-red-600 dark:text-red-400 font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {Number(p.stock).toFixed(0)} / {Number(p.min_stock).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isGym && data.salesByDay.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2.5 mb-5">
            <TrendingUp className="w-5 h-5 text-emerald-500" aria-hidden="true" />
            <h2 className="section-title">Ventas &mdash; Últimos 7 Días</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.salesByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Ventas"]}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              />
              <Bar dataKey="total" fill={chartColors.barGym} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <h2 className="section-title mb-5 text-balance">Ventas Recientes</h2>
        {data.recentInvoices.length === 0 ? (
          <EmptyState icon={<ClipboardList className="w-7 h-7" />} title="Sin ventas recientes" />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="table-header rounded-l-lg">Factura</th>
                  <th className="table-header hidden sm:table-cell">Cliente</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header rounded-r-lg text-right hidden sm:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="table-cell font-semibold text-violet-600 dark:text-violet-400 truncate max-w-[120px]">{inv.number}</td>
                    <td className="table-cell hidden sm:table-cell">{inv.customer?.name || "Consumidor Final"}</td>
                    <td className="table-cell text-right font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(Number(inv.total))}</td>
                    <td className="table-cell text-right text-muted hidden sm:table-cell">{formatDate(inv.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
