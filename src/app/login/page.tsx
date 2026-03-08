"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { useSetAtom } from "jotai";
import { fetchAuthAtom } from "@/store";
import AuthLayout from "@/components/templates/AuthLayout";
import { Button } from "@/components/atoms";

export default function LoginPage() {
  const router = useRouter();
  const fetchAuth = useSetAtom(fetchAuthAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await res.json();
      setForgotSuccess(true);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

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

      await fetchAuth();
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
              {showForgotPassword ? "Recuperar contraseña" : "Sistema de Gestión Comercial"}
            </h1>
            <p className="text-slate-500 mt-2 text-sm">
              {showForgotPassword ? "Ingresa tu correo y te enviaremos un enlace" : "Ingresa tus credenciales para continuar"}
            </p>
          </div>

          {showForgotPassword ? (
            <>
              {forgotSuccess ? (
                <div className="space-y-5">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-sm font-medium">
                    Si el correo existe, recibirás un enlace para restablecer tu contraseña.
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => { setShowForgotPassword(false); setForgotSuccess(false); }}
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Volver al inicio de sesión
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in">
                      {error}
                    </div>
                  )}
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-400 mb-1.5">Correo electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-600" aria-hidden="true" />
                      <input
                        id="forgot-email"
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
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 min-h-[44px]"
                    loading={loading}
                  >
                    {loading ? "Enviando…" : "Enviar enlace"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="w-full text-sm text-slate-400 hover:text-slate-300 transition-colors py-2 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
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

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-slate-400 hover:text-violet-400 transition-colors -mt-2 block"
                >
                  ¿Olvidaste tu contraseña?
                </button>

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
            </>
          )}

          {!showForgotPassword && (
          <div className="mt-6 p-4 bg-white/[0.03] rounded-xl border border-slate-800/60">
            <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider mb-2">Credenciales de prueba</p>
            <div className="space-y-1">
              <p className="text-xs text-slate-500"><span className="text-slate-400 font-medium">Master:</span> master@sistema.com / master123</p>
              <p className="text-xs text-slate-500"><span className="text-slate-400 font-medium">Admin:</span> admin@miempresa.com / admin123</p>
              <p className="text-xs text-slate-500"><span className="text-slate-400 font-medium">Cajero:</span> cajero@miempresa.com / cajero123</p>
            </div>
          </div>
          )}
        </div>
    </AuthLayout>
  );
}
