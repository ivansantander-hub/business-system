/**
 * Header - Application top bar with company switcher, theme toggle, user info.
 *
 * @level Organism
 * @composition Avatar (atom)
 */

"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check, Sun, Moon, MapPin, Bell, Mail, Zap, MessageSquare } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { authUserAtom, themeAtom, toggleThemeAtom, hydrateThemeAtom, themeHydratedAtom, fetchAuthAtom, selectedBranchAtom, unreadNotificationCountAtom, unreadMessagesCountAtom, chatWidgetOpenAtom, permissionsAtom } from "@/store";
import Avatar from "../atoms/Avatar";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  WAITER: "Mesero",
  ACCOUNTANT: "Contador",
  TRAINER: "Entrenador",
};

export default function Header() {
  const user = useAtomValue(authUserAtom);
  const theme = useAtomValue(themeAtom);
  const hydrated = useAtomValue(themeHydratedAtom);
  const toggleTheme = useSetAtom(toggleThemeAtom);
  const hydrateTheme = useSetAtom(hydrateThemeAtom);
  const fetchAuth = useSetAtom(fetchAuthAtom);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  const branches = user?.branches ?? [];
  const selectedBranchId = useAtomValue(selectedBranchAtom);
  const unreadCount = useAtomValue(unreadNotificationCountAtom);
  const setUnreadCount = useSetAtom(unreadNotificationCountAtom);
  const unreadMessagesCount = useAtomValue(unreadMessagesCountAtom);
  const setUnreadMessagesCount = useSetAtom(unreadMessagesCountAtom);
  const setChatWidgetOpen = useSetAtom(chatWidgetOpenAtom);
  const permissions = useAtomValue(permissionsAtom);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<{ id: string; type: string; subject: string; createdAt: string }[]>([]);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowCompanyDropdown(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(target)) {
        setShowBranchDropdown(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(target)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.companyId) return;
    const poll = () => {
      fetch("/api/notifications/inbox/unread-count")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((data: { count: number }) => setUnreadCount(data.count))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [user?.companyId, setUnreadCount]);

  useEffect(() => {
    if (!user?.companyId || !permissions.includes("messaging")) return;
    const poll = () => {
      fetch("/api/conversations")
        .then((r) => (r.ok ? r.json() : []))
        .then((convs: { unreadCount: number }[]) => {
          const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
          setUnreadMessagesCount(total);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [user?.companyId, permissions, setUnreadMessagesCount]);

  async function openNotifDropdown() {
    setShowNotifDropdown((prev) => !prev);
    if (!showNotifDropdown && user?.companyId) {
      const res = await fetch("/api/notifications/inbox?limit=5&unreadOnly=true");
      if (res.ok) {
        const data = await res.json();
        setRecentNotifications(
          data.notifications.map((n: { id: string; type: string; subject: string; createdAt: string }) => ({
            id: n.id,
            type: n.type,
            subject: n.subject,
            createdAt: n.createdAt,
          }))
        );
      }
    }
  }

  async function selectBranch(branchId: string | null) {
    if (branchId === selectedBranchId) {
      setShowBranchDropdown(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      });
      if (res.ok) {
        await fetchAuth();
        window.location.reload();
      }
    } finally {
      setSwitching(false);
      setShowBranchDropdown(false);
    }
  }

  async function switchCompany(companyId: string) {
    if (companyId === user?.companyId) {
      setShowCompanyDropdown(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (res.ok) {
        await fetchAuth();
        window.location.reload();
      }
    } finally {
      setSwitching(false);
      setShowCompanyDropdown(false);
    }
  }

  const hasMultipleCompanies = user?.companies && user.companies.length > 1;

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/50 px-4 sm:px-6 py-3 flex items-center justify-between transition-colors">
      {/* Left: Company switcher */}
      <div className="relative ml-10 lg:ml-0" ref={dropdownRef}>
        {user?.companyName && (
          <button
            onClick={() => hasMultipleCompanies && setShowCompanyDropdown(!showCompanyDropdown)}
            className={`flex items-center gap-2 sm:gap-2.5 text-sm ${
              hasMultipleCompanies
                ? "hover:bg-slate-100 dark:hover:bg-white/[0.05] px-2 sm:px-3 py-2 rounded-xl cursor-pointer transition-all duration-200"
                : "cursor-default px-1"
            }`}
          >
            <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center shadow-glow-sm flex-shrink-0" aria-hidden="true">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white text-sm hidden sm:inline truncate max-w-[200px]">
              {user.companyName}
            </span>
            {hasMultipleCompanies && (
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showCompanyDropdown ? "rotate-180" : ""}`} />
            )}
          </button>
        )}

        {showCompanyDropdown && user?.companies && (
          <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#141925] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-scale-in" style={{ overscrollBehavior: "contain" }}>
            <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Cambiar Empresa
            </div>
            {user.companies.map((c) => (
              <button
                key={c.id}
                onClick={() => switchCompany(c.id)}
                disabled={switching}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-center justify-between transition-colors disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{roleLabels[c.role] || c.role}</p>
                </div>
                {c.id === user.companyId && (
                  <div className="w-5 h-5 bg-gradient-accent rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center: Branch selector (when company has branches) */}
      {branches.length > 0 && (
        <div className="relative hidden sm:block" ref={branchDropdownRef}>
          <button
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all duration-200"
          >
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="truncate max-w-[140px]">
              {selectedBranchId
                ? branches.find((b) => b.id === selectedBranchId)?.name ?? "Sucursal"
                : "Todas las sucursales"}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showBranchDropdown ? "rotate-180" : ""}`} />
          </button>
          {showBranchDropdown && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white dark:bg-[#141925] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-scale-in" style={{ overscrollBehavior: "contain" }}>
              <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                Filtrar por sucursal
              </div>
              <button
                onClick={() => selectBranch(null)}
                disabled={switching}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-center justify-between transition-colors disabled:opacity-50"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">Todas las sucursales</span>
                {!selectedBranchId && (
                  <div className="w-5 h-5 bg-gradient-accent rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
              {branches.filter((b) => b.isActive).map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBranch(b.id)}
                  disabled={switching}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-center justify-between transition-colors disabled:opacity-50"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{b.name}</span>
                  {selectedBranchId === b.id && (
                    <div className="w-5 h-5 bg-gradient-accent rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Right: Messages + Notifications + Theme + User */}
      <div className="flex items-center gap-1 sm:gap-2">
        {user?.companyId && permissions.includes("messaging") && (
          <button
            onClick={() => setChatWidgetOpen((prev) => !prev)}
            aria-label={`Mensajes${unreadMessagesCount > 0 ? `, ${unreadMessagesCount} sin leer` : ""}`}
            className="relative p-2.5 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all duration-200"
          >
            <MessageSquare className="w-[18px] h-[18px]" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
              </span>
            )}
          </button>
        )}
        {user?.companyId && (
          <div className="relative" ref={notifDropdownRef}>
            <button
              onClick={openNotifDropdown}
              aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ""}`}
              className="relative p-2.5 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all duration-200"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifDropdown && (
              <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#141925] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-scale-in">
                <div className="px-4 py-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Notificaciones</span>
                  <Link
                    href="/dashboard/notificaciones"
                    onClick={() => setShowNotifDropdown(false)}
                    className="text-xs font-medium text-violet-500 hover:text-violet-400"
                  >
                    Ver todas
                  </Link>
                </div>
                {recentNotifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No hay notificaciones sin leer
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {recentNotifications.map((n) => (
                      <Link
                        key={n.id}
                        href="/dashboard/notificaciones"
                        onClick={() => setShowNotifDropdown(false)}
                        className="flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            n.type === "email" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                          }`}
                        >
                          {n.type === "email" ? (
                            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{n.subject}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(n.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <button
          onClick={toggleTheme}
          aria-label={!hydrated ? "Cambiar tema" : theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="p-2.5 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all duration-200"
          suppressHydrationWarning
        >
          {!hydrated ? (
            <Moon className="w-[18px] h-[18px]" />
          ) : theme === "dark" ? (
            <Sun className="w-[18px] h-[18px]" />
          ) : (
            <Moon className="w-[18px] h-[18px]" />
          )}
        </button>
        {user && (
          <a href="/dashboard/perfil" className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 ml-1 sm:ml-2 border-l border-slate-200 dark:border-slate-800 hover:opacity-80 transition-opacity">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">{user.name}</p>
              <p className="text-[11px] text-slate-500">{roleLabels[user.role] || user.role}</p>
            </div>
            <Avatar name={user.name} src={user.avatarUrl} size="md" />
          </a>
        )}
      </div>
    </header>
  );
}
