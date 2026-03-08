"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/templates/AuthLayout";
import { Button } from "@/components/atoms";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="bg-[#141925]/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/30 border border-slate-800/60 p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-accent rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-glow">
              <Lock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight" style={{ textWrap: "balance" }}>
              Sistema de Gestión Comercial
            </h1>
            <p className="text-slate-500 mt-2 text-sm">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-400 mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-11 min-h-[44px]"
                  placeholder="usuario@empresa.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-400 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11 min-h-[44px]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 min-h-[44px]"
              loading={loading}
              icon={!loading ? <ArrowRight className="w-4 h-4" /> : undefined}
            >
              {loading ? "Ingresando…" : "Iniciar Sesión"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-white/[0.03] rounded-xl border border-slate-800/60">
            <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider mb-2">Credenciales de prueba</p>
            <div className="space-y-1">
              <p className="text-xs text-slate-500"><span className="text-slate-400 font-medium">Master:</span> master@sistema.com / master123</p>
              <p className="text-xs text-slate-500"><span className="text-slate-400 font-medium">Admin:</span> admin@miempresa.com / admin123</p>
              <p className="text-xs text-slate-500"><span className="text-slate-400 font-medium">Cajero:</span> cajero@miempresa.com / cajero123</p>
            </div>
          </div>
        </div>
    </AuthLayout>
  );
}
