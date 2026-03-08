/**
 * Sidebar - Main application navigation.
 *
 * @level Organism
 * @composition Avatar, NavItem patterns
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, UtensilsCrossed,
  ClipboardList, FileText, Users, Truck, ShoppingBag, Calculator,
  BarChart3, Settings, LogOut, X, Menu, Building2, ChevronsLeft, ChevronsRight,
  UserCheck, CalendarDays, Dumbbell, Ruler, Lock, Ticket, ChevronDown, Bell, Shield, ScrollText, FlaskConical,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAtomValue } from "jotai";
import { permissionsAtom, userRoleAtom, userNameAtom } from "@/store";
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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard", group: "principal" },
  { href: "/dashboard/empresas", label: "Empresas", icon: Building2, permission: "companies", group: "principal" },
  { href: "/dashboard/pos", label: "Punto de Venta", icon: ShoppingCart, permission: "pos", group: "ventas" },
  { href: "/dashboard/mesas", label: "Mesas", icon: UtensilsCrossed, permission: "tables", group: "ventas" },
  { href: "/dashboard/ordenes", label: "Órdenes", icon: ClipboardList, permission: "orders", group: "ventas" },
  { href: "/dashboard/membresias", label: "Membresías", icon: Dumbbell, permission: "memberships", group: "gimnasio" },
  { href: "/dashboard/checkin", label: "Check-in", icon: UserCheck, permission: "checkin", group: "gimnasio" },
  { href: "/dashboard/tiqueteras", label: "Tiqueteras", icon: Ticket, permission: "day_passes", group: "gimnasio" },
  { href: "/dashboard/clases", label: "Clases", icon: CalendarDays, permission: "classes", group: "gimnasio" },
  { href: "/dashboard/entrenadores", label: "Entrenadores", icon: Dumbbell, permission: "trainers", group: "gimnasio" },
  { href: "/dashboard/medidas", label: "Medidas", icon: Ruler, permission: "body_tracking", group: "gimnasio" },
  { href: "/dashboard/casilleros", label: "Casilleros", icon: Lock, permission: "lockers", group: "gimnasio" },
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
  { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell, permission: "notifications", group: "sistema" },
  { href: "/dashboard/rbac", label: "Control de Acceso", icon: Shield, permission: "rbac", group: "sistema" },
  { href: "/dashboard/logs", label: "Registro de Actividad", icon: ScrollText, permission: "logs", group: "sistema" },
  { href: "/dashboard/test-runs", label: "Resultados de Tests", icon: FlaskConical, permission: "test_runs", group: "sistema" },
];

const groupConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  principal: { label: "Principal", icon: LayoutDashboard },
  ventas: { label: "Ventas", icon: ShoppingCart },
  gimnasio: { label: "Gimnasio", icon: Dumbbell },
  inventario: { label: "Inventario", icon: Package },
  finanzas: { label: "Finanzas", icon: Calculator },
  sistema: { label: "Sistema", icon: Settings },
};

function NavLink({
  href, label, icon: Icon, isActive, collapsed, isMobile, onClick,
}: {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>;
  isActive: boolean; collapsed: boolean; isMobile: boolean; onClick?: () => void;
}) {
  const showLabel = !collapsed || isMobile;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group relative flex items-center ${collapsed && !isMobile ? "justify-center" : ""} gap-3 ${collapsed && !isMobile ? "px-0 mx-auto w-10 h-10" : "px-3"} py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
        isActive
          ? "bg-violet-600/15 text-violet-400"
          : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]"
      }`}
    >
      <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200 ${isActive ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300"}`} />
      {showLabel && <span className="truncate">{label}</span>}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-violet-500 rounded-r-full" />
      )}
      {collapsed && !isMobile && (
        <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-xl border border-slate-700">
          {label}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const permissions = useAtomValue(permissionsAtom);
  const userRole = useAtomValue(userRoleAtom);
  const userName = useAtomValue(userNameAtom);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const menuItems = allMenuItems.filter((item) => permissions.includes(item.permission));
  const groups = [...new Set(menuItems.map((i) => i.group))];

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groups) {
      const items = menuItems.filter((i) => i.group === g);
      initial[g] = items.some(
        (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
      );
    }
    setExpandedGroups(initial);
    // Only run on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, permissions.length]);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    globalThis.location.href = "/login";
  }

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: "Master Admin",
    ADMIN: "Administrador",
    CASHIER: "Cajero",
    WAITER: "Mesero",
    ACCOUNTANT: "Contador",
    TRAINER: "Entrenador",
  };

  const navContent = (isMobile: boolean) => {
    const isCompact = collapsed && !isMobile;
    return (
      <div className="flex flex-col h-full">
        {/* Brand */}
        <div className={`flex-shrink-0 ${isCompact ? "p-3 flex justify-center" : "px-5 pt-6 pb-4"}`}>
          {isCompact ? (
            <div className="w-10 h-10 bg-gradient-accent rounded-xl flex items-center justify-center shadow-glow-sm">
              <span className="text-xs font-bold text-white">S</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-accent rounded-xl flex items-center justify-center shadow-glow-sm flex-shrink-0">
                <span className="text-xs font-bold text-white">SGC</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white truncate">SGC</h1>
                <p className="text-[11px] text-slate-600 truncate">Sistema de Gestión</p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={`mx-${isCompact ? "2" : "4"} border-t border-slate-800/60`} />

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto ${isCompact ? "px-2 py-3" : "px-3 py-3"} space-y-0.5`} aria-label="Navegación principal">
          {groups.map((group) => {
            const items = menuItems.filter((i) => i.group === group);
            if (items.length === 0) return null;
            const cfg = groupConfig[group];
            const isExpanded = expandedGroups[group] !== false;
            const hasActiveChild = items.some(
              (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            );

            if (group === "principal") {
              return (
                <div key={group} className="space-y-0.5 mb-2">
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                      collapsed={collapsed}
                      isMobile={isMobile}
                      onClick={closeMobile}
                    />
                  ))}
                </div>
              );
            }

            if (isCompact) {
              return (
                <div key={group}>
                  <div className="my-2 mx-1 border-t border-slate-800/40" />
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                      collapsed={collapsed}
                      isMobile={isMobile}
                      onClick={closeMobile}
                    />
                  ))}
                </div>
              );
            }

            return (
              <div key={group} className="pt-1">
                <button
                  onClick={() => toggleGroup(group)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest rounded-lg transition-colors duration-200 ${
                    hasActiveChild ? "text-violet-400" : "text-slate-600 hover:text-slate-400"
                  }`}
                  aria-expanded={isExpanded}
                >
                  <span className="truncate">{cfg?.label || group}</span>
                  <ChevronDown className={`w-3 h-3 ml-auto transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                </button>
                <div
                  className={`space-y-0.5 overflow-hidden transition-all duration-200 ${
                    isExpanded ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
                  }`}
                >
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                      collapsed={collapsed}
                      isMobile={isMobile}
                      onClick={closeMobile}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`flex-shrink-0 border-t border-slate-800/60 ${isCompact ? "p-2" : "p-3"}`}>
          {/* User info */}
          {!isCompact && userName && (
            <Link
              href="/dashboard/perfil"
              className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl hover:bg-white/[0.04] transition-colors"
              onClick={closeMobile}
            >
              <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white">
                  {userName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{userName}</p>
                <p className="text-[10px] text-slate-600 truncate">{roleLabel[userRole] || userRole}</p>
              </div>
            </Link>
          )}

          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            className={`hidden lg:flex items-center ${isCompact ? "justify-center mx-auto w-10 h-10" : "px-3"} gap-3 py-2 rounded-xl text-[13px] font-medium text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-200 w-full`}
          >
            {isCompact ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronsLeft className="w-4 h-4" />
                <span>Colapsar</span>
              </>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            aria-label="Cerrar Sesión"
            className={`flex items-center ${isCompact ? "justify-center mx-auto w-10 h-10" : "px-3"} gap-3 py-2 rounded-xl text-[13px] font-medium text-slate-600 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200 w-full`}
          >
            <LogOut className="w-4 h-4" />
            {!isCompact && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú de navegación"
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 min-w-[44px] min-h-[44px] bg-[#0f1629] text-white rounded-xl shadow-lg border border-slate-800/50 active:scale-95 transition-transform duration-200"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeMobile} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-[#0f1629] shadow-2xl animate-slide-in-left" style={{ overscrollBehavior: "contain" }}>
            <button
              onClick={closeMobile}
              aria-label="Cerrar menú"
              className="absolute top-4 right-3 p-2 min-w-[44px] min-h-[44px] text-slate-500 hover:text-white transition-colors rounded-xl hover:bg-white/[0.05]"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col ${collapsed ? "w-[68px]" : "w-64"} bg-[#0f1629] h-screen fixed left-0 top-0 z-30 transition-all duration-300 border-r border-slate-800/40`}
      >
        {navContent(false)}
      </aside>
    </>
  );
}
