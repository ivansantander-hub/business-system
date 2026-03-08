"use client";

import { useEffect, useState, useRef } from "react";
import { User, Building2, ChevronDown, Check, Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface CompanyOption {
  id: number;
  name: string;
  role: string;
}

interface UserInfo {
  name: string;
  role: string;
  companyId: number | null;
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

  async function switchCompany(companyId: number) {
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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between transition-colors">
      <div className="relative" ref={dropdownRef}>
        {user?.companyName && (
          <button
            onClick={() => hasMultipleCompanies && setShowCompanyDropdown(!showCompanyDropdown)}
            className={`flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 ${
              hasMultipleCompanies
                ? "hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                : "cursor-default"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span className="font-medium">{user.companyName}</span>
            {hasMultipleCompanies && (
              <ChevronDown className={`w-4 h-4 transition-transform ${showCompanyDropdown ? "rotate-180" : ""}`} />
            )}
          </button>
        )}

        {showCompanyDropdown && user?.companies && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Cambiar empresa
            </div>
            {user.companies.map((c) => (
              <button
                key={c.id}
                onClick={() => switchCompany(c.id)}
                disabled={switching}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between transition-colors disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabels[c.role] || c.role}</p>
                </div>
                {c.id === user.companyId && (
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        {user && (
          <>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabels[user.role] || user.role}</p>
            </div>
            <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
