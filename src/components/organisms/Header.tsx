/**
 * Header - Application top bar with company switcher, theme toggle, user info.
 *
 * @level Organism
 * @composition Avatar (atom)
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check, Sun, Moon } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { authUserAtom, themeAtom, toggleThemeAtom, hydrateThemeAtom, themeHydratedAtom, fetchAuthAtom } from "@/store";
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
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

      {/* Right: Theme + User */}
      <div className="flex items-center gap-1 sm:gap-2">
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
