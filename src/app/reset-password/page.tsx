"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, KeyRound } from "lucide-react";
import AuthLayout from "@/components/templates/AuthLayout";
import { Button } from "@/components/atoms";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (!token) {
      setError("Falta el token de recuperación. Usa el enlace del correo.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al restablecer la contraseña");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="card p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-accent rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-glow">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Restablecer contraseña
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Falta el token. Usa el enlace que enviamos a tu correo.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Volver al inicio de sesión
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card p-6 sm:p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Contraseña actualizada
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Redirigiendo al inicio de sesión…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-accent rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-glow">
          <KeyRound className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Nueva contraseña
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          Ingresa tu nueva contraseña
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="reset-password"
            className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1.5"
          >
            Nueva contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600" aria-hidden="true" />
            <input
              id="reset-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pl-11 min-h-[44px]"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reset-confirm"
            className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1.5"
          >
            Confirmar contraseña
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600" aria-hidden="true" />
            <input
              id="reset-confirm"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field pl-11 min-h-[44px]"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full py-3 min-h-[44px]"
          loading={loading}
        >
          {loading ? "Guardando…" : "Restablecer contraseña"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={
          <div className="card p-6 sm:p-8 animate-pulse">
            <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-2xl mb-6" />
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl mb-4" />
            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
