/**
 * DashboardLayout - Main application layout with sidebar, header, and content area.
 *
 * @level Template
 * @composition Sidebar (organism), Header (organism)
 */

"use client";

import { useState, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { authUserAtom, fetchAuthAtom } from "@/store";
import { Sidebar, Header } from "../organisms";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const user = useAtomValue(authUserAtom);
  const fetchAuth = useSetAtom(fetchAuthAtom);

  usePageTracking();

  useEffect(() => {
    if (!user) fetchAuth();
  }, [user, fetchAuth]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0e1a] transition-colors">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className={`transition-all duration-300 ${collapsed ? "lg:ml-[68px]" : "lg:ml-64"}`}>
        <Header />
        <main className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
