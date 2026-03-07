"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";

export default function Header() {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {});
  }, []);

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador",
    CASHIER: "Cajero",
    WAITER: "Mesero",
    ACCOUNTANT: "Contador",
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">{user.name}</p>
              <p className="text-xs text-gray-500">{roleLabels[user.role] || user.role}</p>
            </div>
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
