"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Pencil, Ban } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { PageHeader, SearchInput, EmptyState } from "@/components/molecules";
import { Spinner, Button } from "@/components/atoms";

interface Company {
  id: string;
  name: string;
  legalName: string | null;
  nit: string;
  address: string | null;
  city: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  taxRegime: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { userCompanies: number };
}

const DEPARTMENTS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar",
  "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó",
  "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
  "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío",
  "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima",
  "Valle del Cauca", "Vaupés", "Vichada",
];

const TAX_REGIMES = [
  "Responsable de IVA",
  "No Responsable de IVA",
  "Régimen Simple de Tributación",
];

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [form, setForm] = useState({
    name: "", legalName: "", nit: "", address: "", city: "",
    department: "", phone: "", email: "", taxRegime: "", type: "RESTAURANT" as string,
  });

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) setCompanies(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  function openCreate() {
    setEditingCompany(null);
    setForm({ name: "", legalName: "", nit: "", address: "", city: "", department: "", phone: "", email: "", taxRegime: "", type: "RESTAURANT" });
    setShowModal(true);
  }

  function openEdit(c: Company) {
    setEditingCompany(c);
    setForm({
      name: c.name, legalName: c.legalName || "", nit: c.nit,
      address: c.address || "", city: c.city || "", department: c.department || "",
      phone: c.phone || "", email: c.email || "", taxRegime: c.taxRegime || "",
      type: (c as unknown as Record<string, string>).type || "RESTAURANT",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingCompany ? `/api/companies/${editingCompany.id}` : "/api/companies";
      const method = editingCompany ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || "Error", type: "error" });
        return;
      }
      setToast({ message: editingCompany ? "Empresa actualizada" : "Empresa creada", type: "success" });
      setShowModal(false);
      fetchCompanies();
    } catch {
      setToast({ message: "Error de conexión", type: "error" });
    }
  }

  async function toggleActive(c: Company) {
    if (c.isActive) {
      await fetch(`/api/companies/${c.id}`, { method: "DELETE" });
      setToast({ message: "Empresa desactivada", type: "success" });
    } else {
      await fetch(`/api/companies/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, isActive: true }),
      });
      setToast({ message: "Empresa activada", type: "success" });
    }
    fetchCompanies();
  }

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.nit.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Building2 className="w-full h-full" />}
        title="Empresas"
        subtitle="Gestión de empresas del sistema"
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o NIT..."
              className="w-full sm:w-auto sm:min-w-[300px]"
            />
            <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
              Nueva Empresa
            </Button>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title="No se encontraron empresas"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className={`card p-5 ${!c.isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 dark:bg-violet-500/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">NIT: {c.nit}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${c.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                {c.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {c.city && <p>{c.city}{c.department ? `, ${c.department}` : ""}</p>}
              {c.phone && <p>{c.phone}</p>}
              {c.taxRegime && <p className="text-xs">{c.taxRegime}</p>}
              <p className="text-xs text-slate-400 dark:text-slate-500">{c._count.userCompanies} usuario(s)</p>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button variant="secondary" size="sm" onClick={() => openEdit(c)} icon={<Pencil className="w-3 h-3" />}>
                Editar
              </Button>
              <Button
                variant={c.isActive ? "danger" : "success"}
                size="sm"
                onClick={() => toggleActive(c)}
                icon={<Ban className="w-3 h-3" />}
              >
                {c.isActive ? "Desactivar" : "Activar"}
              </Button>
            </div>
          </div>
        ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingCompany ? "Editar Empresa" : "Nueva Empresa"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!editingCompany && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de empresa *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: "RESTAURANT", label: "Restaurante / Bar", desc: "Mesas, órdenes, meseros, cocina" },
                    { value: "GYM", label: "Gimnasio", desc: "Membresías, check-in, clases, entrenadores" },
                  ].map((t) => (
                    <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${form.type === t.value ? "border-violet-600 bg-violet-50 dark:border-violet-400 dark:bg-violet-500/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"}`}>
                      <p className="font-medium text-sm">{t.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre comercial *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Razón social</label>
              <input className="input-field" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NIT *</label>
              <input className="input-field" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} required placeholder="900123456-7" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Régimen tributario</label>
              <select className="input-field" value={form.taxRegime} onChange={(e) => setForm({ ...form, taxRegime: e.target.value })}>
                <option value="">Seleccionar...</option>
                {TAX_REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ciudad</label>
              <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Departamento</label>
              <select className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Seleccionar...</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
              <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit">{editingCompany ? "Actualizar" : "Crear Empresa"}</Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
