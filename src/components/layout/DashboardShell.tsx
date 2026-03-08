"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0e1a] transition-colors">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className={`transition-all duration-300 ${collapsed ? "lg:ml-[68px]" : "lg:ml-64"}`}
      >
        <Header />
        <main className="p-6 max-w-[1600px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
