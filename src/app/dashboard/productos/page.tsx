"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { PageHeader, SearchInput, EmptyState } from "@/components/molecules";

interface Product {
  id: string; name: string; description: string | null; barcode: string | null;
  categoryId: string | null; category: { id: string; name: string } | null;
  unit: string; costPrice: string; salePrice: string; stock: string; minStock: string;
  isActive: boolean;
}
interface Category { id: string; name: string; }

const emptyForm = { name: "", description: "", barcode: "", categoryId: "", unit: "unidad", costPrice: "", salePrice: "", stock: "0", minStock: "5" };

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterCategory) params.set("categoryId", filterCategory);
    const res = await fetch(`/api/products?${params}`);
    if (res.ok) {
      setProducts(await res.json());
    } else {
      setProducts([]);
    }
  }, [search, filterCategory]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(setCategories);
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "", barcode: p.barcode || "",
      categoryId: p.categoryId?.toString() || "", unit: p.unit,
      costPrice: p.costPrice, salePrice: p.salePrice, stock: p.stock, minStock: p.minStock,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/products/${editing.id}` : "/api/products";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setShowModal(false);
      load();
      setToast({ message: editing ? "Producto actualizado" : "Producto creado", type: "success" });
    } else {
      setToast({ message: "Error al guardar", type: "error" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar este producto?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
    setToast({ message: "Producto desactivado", type: "success" });
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader icon={<Package className="w-full h-full" />} title="Productos" actions={<button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Producto</button>} />

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o código..." className="w-full sm:w-auto sm:min-w-[300px] sm:flex-1" />
          <select className="input-field w-full sm:w-auto" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {products.length === 0 ? (
          <EmptyState icon={<Package className="w-7 h-7" />} title="No se encontraron productos" />
        ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="table-header rounded-l-lg">Nombre</th>
                <th className="table-header hidden sm:table-cell">Categoría</th>
                <th className="table-header hidden md:table-cell">Código</th>
                <th className="table-header text-right hidden lg:table-cell">Costo</th>
                <th className="table-header text-right">Precio</th>
                <th className="table-header text-right">Stock</th>
                <th className="table-header hidden sm:table-cell">Estado</th>
                <th className="table-header rounded-r-lg">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="table-cell font-medium truncate max-w-[180px]">{p.name}</td>
                  <td className="table-cell hidden sm:table-cell">{p.category?.name || "-"}</td>
                  <td className="table-cell text-slate-500 dark:text-slate-400 hidden md:table-cell">{p.barcode || "-"}</td>
                  <td className="table-cell text-right hidden lg:table-cell">{formatCurrency(p.costPrice)}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(p.salePrice)}</td>
                  <td className={`table-cell text-right font-semibold ${Number(p.stock) <= Number(p.minStock) ? "text-red-600" : "text-slate-700 dark:text-slate-300"}`}>
                    {Number(p.stock).toFixed(0)}
                  </td>
                  <td className="table-cell hidden sm:table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-[#0a0e1a]/30 dark:text-slate-400"}`}>
                      {p.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-xl" title="Editar">
                        <Pencil className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl" title="Desactivar">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center text-slate-400 dark:text-slate-500 py-12">No se encontraron productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Producto" : "Nuevo Producto"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
              <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
              <select className="input-field" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código de barras</label>
              <input className="input-field" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidad</label>
              <select className="input-field" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo</option>
                <option value="litro">Litro</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio de Costo</label>
              <input type="number" step="0.01" className="input-field" value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Precio de Venta *</label>
              <input type="number" step="0.01" className="input-field" value={form.salePrice} onChange={e => setForm({...form, salePrice: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Actual</label>
              <input type="number" className="input-field" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Mínimo</label>
              <input type="number" className="input-field" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? "Actualizar" : "Crear"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
