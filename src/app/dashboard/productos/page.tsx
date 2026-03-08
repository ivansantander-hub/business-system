"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";

interface Product {
  id: number; name: string; description: string | null; barcode: string | null;
  categoryId: number | null; category: { id: number; name: string } | null;
  unit: string; costPrice: string; salePrice: string; stock: string; minStock: string;
  isActive: boolean;
}
interface Category { id: number; name: string; }

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

  async function handleDelete(id: number) {
    if (!confirm("¿Desactivar este producto?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
    setToast({ message: "Producto desactivado", type: "success" });
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productos</h1>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo Producto
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input className="input-field pl-9" placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field w-auto" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Nombre</th>
                <th className="table-header">Categoría</th>
                <th className="table-header">Código</th>
                <th className="table-header text-right">Costo</th>
                <th className="table-header text-right">Precio</th>
                <th className="table-header text-right">Stock</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="table-cell font-medium">{p.name}</td>
                  <td className="table-cell">{p.category?.name || "-"}</td>
                  <td className="table-cell text-gray-500 dark:text-gray-400">{p.barcode || "-"}</td>
                  <td className="table-cell text-right">{formatCurrency(p.costPrice)}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(p.salePrice)}</td>
                  <td className={`table-cell text-right font-semibold ${Number(p.stock) <= Number(p.minStock) ? "text-red-600" : "text-gray-700 dark:text-gray-300"}`}>
                    {Number(p.stock).toFixed(0)}
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400"}`}>
                      {p.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg" title="Editar">
                        <Pencil className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Desactivar">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center text-gray-400 dark:text-gray-500 py-12">No se encontraron productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Editar Producto" : "Nuevo Producto"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
              <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select className="input-field" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código de barras</label>
              <input className="input-field" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidad</label>
              <select className="input-field" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo</option>
                <option value="litro">Litro</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Costo</label>
              <input type="number" step="0.01" className="input-field" value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio de Venta *</label>
              <input type="number" step="0.01" className="input-field" value={form.salePrice} onChange={e => setForm({...form, salePrice: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Actual</label>
              <input type="number" className="input-field" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Mínimo</label>
              <input type="number" className="input-field" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? "Actualizar" : "Crear"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
