"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, UtensilsCrossed,
  ClipboardList, FileText, Users, Truck, ShoppingBag, Calculator,
  BarChart3, Settings, LogOut, X, Menu, Building2, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Permission } from "@/lib/rbac";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const allMenuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/dashboard/empresas", label: "Empresas", icon: Building2, permission: "companies" },
  { href: "/dashboard/productos", label: "Productos", icon: Package, permission: "products" },
  { href: "/dashboard/inventario", label: "Inventario", icon: Warehouse, permission: "inventory" },
  { href: "/dashboard/pos", label: "Punto de Venta", icon: ShoppingCart, permission: "pos" },
  { href: "/dashboard/mesas", label: "Mesas", icon: UtensilsCrossed, permission: "tables" },
  { href: "/dashboard/ordenes", label: "Órdenes", icon: ClipboardList, permission: "orders" },
  { href: "/dashboard/facturas", label: "Facturas", icon: FileText, permission: "invoices" },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users, permission: "customers" },
  { href: "/dashboard/proveedores", label: "Proveedores", icon: Truck, permission: "suppliers" },
  { href: "/dashboard/compras", label: "Compras", icon: ShoppingBag, permission: "purchases" },
  { href: "/dashboard/contabilidad", label: "Contabilidad", icon: Calculator, permission: "accounting" },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3, permission: "reports" },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: Users, permission: "users" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings, permission: "settings" },
];

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const navContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full">
      <div className={`border-b border-slate-700 ${collapsed && !isMobile ? "p-3 flex justify-center" : "p-5"}`}>
        {collapsed && !isMobile ? (
          <span className="text-lg font-bold text-white">S</span>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white">SGC</h1>
            <p className="text-xs text-slate-400 mt-1">
              {userRole === "SUPER_ADMIN" ? "Panel Maestro" : "Sistema de Gestión"}
            </p>
          </>
        )}
      </div>
      <nav className={`flex-1 overflow-y-auto py-4 ${collapsed && !isMobile ? "px-2" : "px-3"} space-y-1`}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed && !isMobile ? item.label : undefined}
              className={`flex items-center ${collapsed && !isMobile ? "justify-center" : ""} gap-3 ${collapsed && !isMobile ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className={`border-t border-slate-700 ${collapsed && !isMobile ? "p-2" : "p-3"} space-y-1`}>
        <button
          onClick={onToggle}
          className={`hidden lg:flex items-center ${collapsed && !isMobile ? "justify-center" : ""} gap-3 ${collapsed && !isMobile ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full`}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed && !isMobile ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5" />
              <span>Colapsar</span>
            </>
          )}
        </button>
        <button
          onClick={handleLogout}
          className={`flex items-center ${collapsed && !isMobile ? "justify-center" : ""} gap-3 ${collapsed && !isMobile ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full`}
          title={collapsed && !isMobile ? "Cerrar Sesión" : undefined}
        >
          <LogOut className="w-5 h-5" />
          {(!collapsed || isMobile) && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 text-white rounded-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-slate-400">
              <X className="w-5 h-5" />
            </button>
            {navContent(true)}
          </div>
        </div>
      )}

      <aside
        className={`hidden lg:block ${collapsed ? "w-16" : "w-64"} bg-slate-800 min-h-screen fixed left-0 top-0 z-30 transition-all duration-300`}
      >
        {navContent(false)}
      </aside>
    </>
  );
}
