"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className={`transition-all duration-300 ${collapsed ? "lg:ml-16" : "lg:ml-64"}`}
      >
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
