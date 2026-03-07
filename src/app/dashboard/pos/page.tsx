"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, Search, Plus, Minus, Trash2, CreditCard, Banknote, Building2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";

interface Product { id: number; name: string; salePrice: string; stock: string; category: { name: string } | null; barcode: string | null; }
interface CartItem { product: Product; quantity: number; unitPrice: number; total: number; }
interface Category { id: number; name: string; }

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmount, setPaidAmount] = useState("");
  const [customerName, setCustomerName] = useState("Consumidor Final");
  const [customerNit, setCustomerNit] = useState("CF");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [cashSession, setCashSession] = useState<{ id: number } | null>(null);
  const [showCashOpen, setShowCashOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams({ active: "true" });
    if (search) params.set("search", search);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    const res = await fetch(`/api/products?${params}`);
    setProducts(await res.json());
  }, [search, selectedCategory]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories);
    fetch("/api/cash?action=current").then(r => r.json()).then(session => {
      if (session) setCashSession(session);
    });
  }, []);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i
        );
      }
      const unitPrice = Number(product.salePrice);
      return [...prev, { product, quantity: 1, unitPrice, total: unitPrice }];
    });
  }

  function updateQuantity(productId: number, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total: newQty * i.unitPrice };
    }));
  }

  function removeFromCart(productId: number) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const tax = subtotal * 0.12;
  const total = subtotal + tax;
  const change = Number(paidAmount) - total;

  async function openCashRegister(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open", openingAmount: Number(openingAmount) || 0 }),
    });
    if (res.ok) {
      const session = await res.json();
      setCashSession(session);
      setShowCashOpen(false);
      setToast({ message: "Caja abierta", type: "success" });
    } else {
      const data = await res.json();
      setToast({ message: data.error, type: "error" });
    }
  }

  async function handlePayment() {
    if (paymentMethod === "CASH" && Number(paidAmount) < total) {
      setToast({ message: "Monto insuficiente", type: "error" });
      return;
    }

    const items = cart.map(i => ({
      productId: i.product.id,
      productName: i.product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        paymentMethod,
        paidAmount: paymentMethod === "CASH" ? Number(paidAmount) : total,
        discount: 0,
        notes: `Cliente: ${customerName} - NIT: ${customerNit}`,
      }),
    });

    if (res.ok) {
      setCart([]);
      setShowPayment(false);
      setPaidAmount("");
      setCustomerName("Consumidor Final");
      setCustomerNit("CF");
      loadProducts();
      setToast({ message: "Venta registrada exitosamente", type: "success" });
    } else {
      setToast({ message: "Error al procesar venta", type: "error" });
    }
  }

  if (!cashSession) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <ShoppingCart className="w-16 h-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-600">Caja cerrada</h2>
        <p className="text-gray-400">Debe abrir la caja para comenzar a vender</p>
        <button onClick={() => setShowCashOpen(true)} className="btn-primary text-lg px-8 py-3">Abrir Caja</button>
        <Modal open={showCashOpen} onClose={() => setShowCashOpen(false)} title="Abrir Caja" size="sm">
          <form onSubmit={openCashRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto Inicial</label>
              <input type="number" step="0.01" className="input-field" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCashOpen(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">Abrir Caja</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Products panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-9" placeholder="Buscar producto o escanear código..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
          <select className="input-field w-auto" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.filter(p => Number(p.stock) > 0).map(p => (
              <button key={p.id} onClick={() => addToCart(p)}
                className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all">
                <p className="font-medium text-gray-900 text-sm truncate">{p.name}</p>
                <p className="text-xs text-gray-400 mt-1">{p.category?.name}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold text-indigo-600">Q {Number(p.salePrice).toFixed(2)}</span>
                  <span className="text-xs text-gray-400">Stock: {Number(p.stock).toFixed(0)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-96 bg-white rounded-xl border border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Carrito ({cart.length})
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Agrega productos al carrito</p>
          ) : cart.map(item => (
            <div key={item.product.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-gray-900 flex-1">{item.product.name}</p>
                <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center hover:bg-indigo-200 text-indigo-600">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="font-semibold text-gray-900">Q {item.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span><span>Q {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>IVA (12%)</span><span>Q {tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
            <span>Total</span><span>Q {total.toFixed(2)}</span>
          </div>
          <button onClick={() => { setShowPayment(true); setPaidAmount(total.toFixed(2)); }} disabled={cart.length === 0}
            className="btn-success w-full py-3 text-lg mt-3 flex items-center justify-center gap-2">
            <CreditCard className="w-5 h-5" /> Cobrar
          </button>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Procesar Pago" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Cliente</label>
              <input className="input-field" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
              <input className="input-field" value={customerNit} onChange={e => setCustomerNit(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "CASH", label: "Efectivo", icon: Banknote },
                { value: "CARD", label: "Tarjeta", icon: CreditCard },
                { value: "TRANSFER", label: "Transferencia", icon: Building2 },
              ].map(m => (
                <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                    paymentMethod === m.value ? "border-indigo-600 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <m.icon className={`w-6 h-6 ${paymentMethod === m.value ? "text-indigo-600" : "text-gray-400"}`} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-lg font-bold">
              <span>Total a Cobrar</span><span className="text-indigo-600">Q {total.toFixed(2)}</span>
            </div>
            {paymentMethod === "CASH" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto Recibido</label>
                  <input type="number" step="0.01" className="input-field text-xl font-bold text-center"
                    value={paidAmount} onChange={e => setPaidAmount(e.target.value)} autoFocus />
                </div>
                {change >= 0 && Number(paidAmount) > 0 && (
                  <div className="flex justify-between text-xl font-bold text-emerald-600 pt-2">
                    <span>Cambio</span><span>Q {change.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowPayment(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handlePayment} className="btn-success flex-1 py-3 text-lg">Confirmar Pago</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
