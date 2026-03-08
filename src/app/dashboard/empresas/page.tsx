"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Pencil, Ban, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";

interface Company {
  id: number;
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
  _count: { users: number };
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
    department: "", phone: "", email: "", taxRegime: "",
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
    setForm({ name: "", legalName: "", nit: "", address: "", city: "", department: "", phone: "", email: "", taxRegime: "" });
    setShowModal(true);
  }

  function openEdit(c: Company) {
    setEditingCompany(c);
    setForm({
      name: c.name, legalName: c.legalName || "", nit: c.nit,
      address: c.address || "", city: c.city || "", department: c.department || "",
      phone: c.phone || "", email: c.email || "", taxRegime: c.taxRegime || "",
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
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-500 mt-1">Gestión de empresas del sistema</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva Empresa
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text" placeholder="Buscar por nombre o NIT..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <div key={c.id} className={`card p-5 ${!c.isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  <p className="text-xs text-gray-500">NIT: {c.nit}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${c.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {c.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-gray-600">
              {c.city && <p>{c.city}{c.department ? `, ${c.department}` : ""}</p>}
              {c.phone && <p>{c.phone}</p>}
              {c.taxRegime && <p className="text-xs">{c.taxRegime}</p>}
              <p className="text-xs text-gray-400">{c._count.users} usuario(s)</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => openEdit(c)} className="btn-secondary text-xs flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Editar
              </button>
              <button onClick={() => toggleActive(c)} className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg ${c.isActive ? "btn-danger" : "btn-success"}`}>
                <Ban className="w-3 h-3" /> {c.isActive ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">No se encontraron empresas</div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCompany ? "Editar Empresa" : "Nueva Empresa"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre comercial *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón social</label>
              <input className="input-field" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIT *</label>
              <input className="input-field" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} required placeholder="900123456-7" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Régimen tributario</label>
              <select className="input-field" value={form.taxRegime} onChange={(e) => setForm({ ...form, taxRegime: e.target.value })}>
                <option value="">Seleccionar...</option>
                {TAX_REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
              <select className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Seleccionar...</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editingCompany ? "Actualizar" : "Crear Empresa"}</button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
