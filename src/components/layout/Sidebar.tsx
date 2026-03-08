"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, UtensilsCrossed,
  ClipboardList, FileText, Users, Truck, ShoppingBag, Calculator,
  BarChart3, Settings, LogOut, X, Menu, Building2, PanelLeftClose, PanelLeftOpen,
  UserCheck, CalendarDays, Dumbbell, Ruler, Lock, Ticket,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Permission } from "@/lib/rbac";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  group: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const allMenuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard", group: "main" },
  { href: "/dashboard/empresas", label: "Empresas", icon: Building2, permission: "companies", group: "main" },
  { href: "/dashboard/pos", label: "Punto de Venta", icon: ShoppingCart, permission: "pos", group: "ventas" },
  { href: "/dashboard/mesas", label: "Mesas", icon: UtensilsCrossed, permission: "tables", group: "ventas" },
  { href: "/dashboard/ordenes", label: "Órdenes", icon: ClipboardList, permission: "orders", group: "ventas" },
  { href: "/dashboard/membresias", label: "Membresías", icon: Dumbbell, permission: "memberships", group: "gym" },
  { href: "/dashboard/checkin", label: "Check-in", icon: UserCheck, permission: "checkin", group: "gym" },
  { href: "/dashboard/tiqueteras", label: "Tiqueteras", icon: Ticket, permission: "day_passes", group: "gym" },
  { href: "/dashboard/clases", label: "Clases", icon: CalendarDays, permission: "classes", group: "gym" },
  { href: "/dashboard/entrenadores", label: "Entrenadores", icon: Dumbbell, permission: "trainers", group: "gym" },
  { href: "/dashboard/medidas", label: "Medidas", icon: Ruler, permission: "body_tracking", group: "gym" },
  { href: "/dashboard/casilleros", label: "Casilleros", icon: Lock, permission: "lockers", group: "gym" },
  { href: "/dashboard/productos", label: "Productos", icon: Package, permission: "products", group: "inventario" },
  { href: "/dashboard/inventario", label: "Inventario", icon: Warehouse, permission: "inventory", group: "inventario" },
  { href: "/dashboard/facturas", label: "Facturas", icon: FileText, permission: "invoices", group: "finanzas" },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users, permission: "customers", group: "finanzas" },
  { href: "/dashboard/proveedores", label: "Proveedores", icon: Truck, permission: "suppliers", group: "finanzas" },
  { href: "/dashboard/compras", label: "Compras", icon: ShoppingBag, permission: "purchases", group: "finanzas" },
  { href: "/dashboard/contabilidad", label: "Contabilidad", icon: Calculator, permission: "accounting", group: "finanzas" },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, permission: "reports", group: "sistema" },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: Users, permission: "users", group: "sistema" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings, permission: "settings", group: "sistema" },
];

const groupLabels: Record<string, string> = {
  main: "",
  ventas: "Ventas",
  gym: "Gimnasio",
  inventario: "Inventario",
  finanzas: "Finanzas",
  sistema: "Sistema",
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role || "");
        setPermissions(data.permissions || []);
      })
      .catch(() => {});
  }, []);

  const menuItems = allMenuItems.filter((item) =>
    permissions.includes(item.permission)
  );

  const groups = [...new Set(menuItems.map((i) => i.group))];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    globalThis.location.href = "/login";
  }

  const navContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full">
      <div className={`${collapsed && !isMobile ? "p-3 flex justify-center" : "px-5 py-6"}`}>
        {collapsed && !isMobile ? (
          <div className="w-9 h-9 bg-gradient-accent rounded-xl flex items-center justify-center shadow-glow-sm">
            <span className="text-sm font-bold text-white">S</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-accent rounded-xl flex items-center justify-center shadow-glow-sm flex-shrink-0">
              <span className="text-sm font-bold text-white">SGC</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">SGC</h1>
              <p className="text-[11px] text-slate-500 truncate">
                {userRole === "SUPER_ADMIN" ? "Panel Maestro" : "Sistema de Gestión"}
              </p>
            </div>
          </div>
        )}
      </div>

      <nav className={`flex-1 overflow-y-auto ${collapsed && !isMobile ? "px-2 py-2" : "px-3 py-2"} space-y-1`}>
        {groups.map((group) => {
          const items = menuItems.filter((i) => i.group === group);
          if (items.length === 0) return null;
          const label = groupLabels[group];
          return (
            <div key={group}>
              {label && !collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pt-4 pb-1.5">
                  {label}
                </p>
              )}
              {label && collapsed && !isMobile && (
                <div className="my-2 mx-2 border-t border-slate-800" />
              )}
              {items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={`flex items-center ${collapsed && !isMobile ? "justify-center" : ""} gap-3 ${collapsed && !isMobile ? "px-2" : "px-3"} py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-accent text-white shadow-glow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "" : "opacity-70"}`} />
                    {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={`border-t border-slate-800/80 ${collapsed && !isMobile ? "p-2" : "p-3"} space-y-1`}>
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className={`hidden lg:flex items-center ${collapsed && !isMobile ? "justify-center" : ""} gap-3 ${collapsed && !isMobile ? "px-2" : "px-3"} py-2 rounded-xl text-[13px] font-medium text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all duration-200 w-full`}
        >
          {collapsed && !isMobile ? (
            <PanelLeftOpen className="w-[18px] h-[18px]" />
          ) : (
            <>
              <PanelLeftClose className="w-[18px] h-[18px]" />
              <span>Colapsar</span>
            </>
          )}
        </button>
        <button
          onClick={handleLogout}
          aria-label="Cerrar Sesión"
          className={`flex items-center ${collapsed && !isMobile ? "justify-center" : ""} gap-3 ${collapsed && !isMobile ? "px-2" : "px-3"} py-2 rounded-xl text-[13px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200 w-full`}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {(!collapsed || isMobile) && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-[#0f1629] text-white rounded-xl shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full bg-[#0f1629] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="absolute top-5 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent(true)}
          </div>
        </div>
      )}

      <aside
        className={`hidden lg:block ${collapsed ? "w-[68px]" : "w-64"} bg-[#0f1629] min-h-screen fixed left-0 top-0 z-30 transition-all duration-300 border-r border-slate-800/50`}
      >
        {navContent(false)}
      </aside>
    </>
  );
}
