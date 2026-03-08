"use client";

import { useEffect, useState, useRef } from "react";
import { User, Building2, ChevronDown, Check, Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface CompanyOption {
  id: string;
  name: string;
  role: string;
}

interface UserInfo {
  name: string;
  role: string;
  companyId: string | null;
  companyName?: string;
  companies?: CompanyOption[];
}

export default function Header() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {});
  }, []);

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
        window.location.reload();
      }
    } finally {
      setSwitching(false);
      setShowCompanyDropdown(false);
    }
  }

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Administrador",
    ADMIN: "Administrador",
    CASHIER: "Cajero",
    WAITER: "Mesero",
    ACCOUNTANT: "Contador",
    TRAINER: "Entrenador",
  };

  const hasMultipleCompanies = user?.companies && user.companies.length > 1;

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-[#0a0e1a]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/50 px-6 py-3 flex items-center justify-between transition-colors">
      <div className="relative" ref={dropdownRef}>
        {user?.companyName && (
          <button
            onClick={() => hasMultipleCompanies && setShowCompanyDropdown(!showCompanyDropdown)}
            className={`flex items-center gap-2.5 text-sm ${
              hasMultipleCompanies
                ? "hover:bg-slate-100 dark:hover:bg-white/[0.05] px-3 py-2 rounded-xl cursor-pointer transition-all duration-200"
                : "cursor-default px-1"
            }`}
          >
            <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center shadow-glow-sm flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-slate-900 dark:text-white text-sm">{user.companyName}</span>
            </div>
            {hasMultipleCompanies && (
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showCompanyDropdown ? "rotate-180" : ""}`} />
            )}
          </button>
        )}

        {showCompanyDropdown && user?.companies && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-[#141925] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-scale-in">
            <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Cambiar empresa
            </div>
            {user.companies.map((c) => (
              <button
                key={c.id}
                onClick={() => switchCompany(c.id)}
                disabled={switching}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex items-center justify-between transition-colors disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">{roleLabels[c.role] || c.role}</p>
                </div>
                {c.id === user.companyId && (
                  <div className="w-5 h-5 bg-gradient-accent rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all duration-200"
        >
          {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>
        {user && (
          <div className="flex items-center gap-3 pl-2 ml-2 border-l border-slate-200 dark:border-slate-800">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
              <p className="text-[11px] text-slate-500">{roleLabels[user.role] || user.role}</p>
            </div>
            <div className="w-9 h-9 bg-gradient-accent rounded-xl flex items-center justify-center shadow-glow-sm">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
