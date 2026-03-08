"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { User, Mail, Lock, Camera, Trash2, Save, Eye, EyeOff, Shield } from "lucide-react";
import { useSetAtom } from "jotai";
import { fetchAuthAtom } from "@/store";
import Toast from "@/components/ui/Toast";
import { PageHeader } from "@/components/molecules";
import { Button, Input } from "@/components/atoms";
import Avatar from "@/components/atoms/Avatar";
import { formatDate } from "@/lib/utils";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  WAITER: "Mesero",
  ACCOUNTANT: "Contador",
  TRAINER: "Entrenador",
};

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fetchAuth = useSetAtom(fetchAuthAtom);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/profile");
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setName(data.name);
      setEmail(data.email);
      if (data.avatarUrl) setAvatarPreview(`/api/profile/avatar?t=${Date.now()}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name !== profile?.name) body.name = name;
      if (email !== profile?.email) body.email = email;

      if (Object.keys(body).length === 0) {
        setToast({ message: "Sin cambios", type: "success" });
        return;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setToast({ message: "Información actualizada", type: "success" });
        await loadProfile();
        await fetchAuth();
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Error al actualizar", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setToast({ message: "Las contraseñas no coinciden", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        setToast({ message: "Contraseña actualizada", type: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Error al cambiar contraseña", type: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });

      if (res.ok) {
        setAvatarPreview(`/api/profile/avatar?t=${Date.now()}`);
        setToast({ message: "Foto de perfil actualizada", type: "success" });
        await fetchAuth();
      } else {
        const data = await res.json();
        setToast({ message: data.error || "Error al subir foto", type: "error" });
      }
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAvatar() {
    if (!confirm("¿Eliminar la foto de perfil?")) return;
    const res = await fetch("/api/profile/avatar", { method: "DELETE" });
    if (res.ok) {
      setAvatarPreview(null);
      setToast({ message: "Foto de perfil eliminada", type: "success" });
      await fetchAuth();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader icon={<User className="w-full h-full" />} title="Mi Perfil" />

      {/* Avatar Section */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <Avatar name={profile?.name || ""} src={avatarPreview} size="xl" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              disabled={uploadingAvatar}
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{profile?.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full text-xs font-medium">
                <Shield className="w-3 h-3" />
                {roleLabels[profile?.role || ""] || profile?.role}
              </span>
              <span className="text-xs text-slate-400">
                Miembro desde {formatDate(profile?.createdAt || "")}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              icon={<Camera className="w-4 h-4" />}
            >
              {uploadingAvatar ? "Subiendo..." : "Cambiar"}
            </Button>
            {avatarPreview && (
              <Button variant="danger" size="sm" onClick={handleDeleteAvatar} icon={<Trash2 className="w-4 h-4" />}>
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Basic Info Form */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-violet-500" />
          Información Personal
        </h3>
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico</label>
              <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} icon={<Save className="w-4 h-4" />}>
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </div>

      {/* Password Change Form */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-violet-500" />
          Cambiar Contraseña
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="current-pwd" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña Actual</label>
            <div className="relative">
              <Input
                id="current-pwd"
                type={showCurrentPwd ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="new-pwd" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nueva Contraseña</label>
              <div className="relative">
                <Input
                  id="new-pwd"
                  type={showNewPwd ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-pwd" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar Contraseña</label>
              <Input
                id="confirm-pwd"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword} icon={<Lock className="w-4 h-4" />}>
              {saving ? "Actualizando..." : "Cambiar Contraseña"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
