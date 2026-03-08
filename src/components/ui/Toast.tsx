"use client";

import { useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = { success: CheckCircle, error: XCircle, info: AlertCircle };
  const colors = {
    success: "bg-emerald-50 border-emerald-200/80 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300",
    error: "bg-red-50 border-red-200/80 text-red-800 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300",
    info: "bg-blue-50 border-blue-200/80 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300",
  };
  const Icon = icons[type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-sm ${colors[type]} animate-slide-up`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} aria-label="Cerrar notificación" className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
