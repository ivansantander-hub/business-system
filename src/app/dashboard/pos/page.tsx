"use client";

import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, Plus, Minus, CreditCard, Banknote, Building2, X, Dumbbell, Ticket } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { SearchInput } from "@/components/molecules";

interface Product { id: string; name: string; salePrice: string; stock: string; category: { name: string } | null; barcode: string | null; }
interface CartItem { product: Product; quantity: number; unitPrice: number; total: number; }
interface Category { id: string; name: string; }
interface MembershipPlan { id: string; name: string; durationDays: number; price: string; description: string | null; }
interface GymMemberOption { id: string; customer: { name: string; email: string | null } }

type PosTab = "products" | "memberships" | "daypasses";

export default function POSPage() {
  const [companyType, setCompanyType] = useState<string>("RESTAURANT");
  const [activeTab, setActiveTab] = useState<PosTab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmount, setPaidAmount] = useState("");
  const [customerName, setCustomerName] = useState("Consumidor Final");
  const [customerNit, setCustomerNit] = useState("222222222");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [cashSession, setCashSession] = useState<{ id: string } | null>(null);
  const [showCashOpen, setShowCashOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [gymMembers, setGymMembers] = useState<GymMemberOption[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [dayPassPrice, setDayPassPrice] = useState("15000");
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then((data: Record<string, unknown> | null) => {
      setCompanyType((data?.companyType as string) || "RESTAURANT");
    });
  }, []);

  const loadProducts = useCallback(async () => {
    const params = new URLSearchParams({ active: "true" });
    if (search && activeTab === "products") params.set("search", search);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    const res = await fetch(`/api/products?${params}`);
    if (res.ok) setProducts(await res.json());
    else setProducts([]);
  }, [search, selectedCategory, activeTab]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    fetch("/api/categories").then(r => r.ok ? r.json() : []).then(setCategories);
    fetch("/api/cash?action=current").then(r => r.ok ? r.json() : null).then(session => {
      if (session) setCashSession(session);
    });
  }, []);

  useEffect(() => {
    if (companyType === "GYM") {
      fetch("/api/membership-plans").then(r => r.ok ? r.json() : []).then(setPlans);
    }
  }, [companyType]);

  useEffect(() => {
    if (companyType === "GYM" && memberSearch.length >= 2) {
      fetch(`/api/gym-members?search=${encodeURIComponent(memberSearch)}`)
        .then(r => r.ok ? r.json() : []).then(setGymMembers);
    }
  }, [memberSearch, companyType]);

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

  function addPlanToCart(plan: MembershipPlan) {
    const fakeProduct: Product = {
      id: `virtual-membership-${plan.id}`,
      name: `Membresía: ${plan.name} (${plan.durationDays} días)`,
      salePrice: plan.price,
      stock: "999",
      category: { name: "Membresía" },
      barcode: null,
    };
    setCart(prev => [...prev, {
      product: fakeProduct,
      quantity: 1,
      unitPrice: Number(plan.price),
      total: Number(plan.price),
    }]);
  }

  function addDayPassToCart() {
    const price = Number(dayPassPrice) || 0;
    const fakeProduct: Product = {
      id: `virtual-daypass-${Date.now()}`,
      name: `Pase del Día${guestName ? `: ${guestName}` : ""}`,
      salePrice: String(price),
      stock: "999",
      category: { name: "Pase Día" },
      barcode: null,
    };
    setCart(prev => [...prev, {
      product: fakeProduct,
      quantity: 1,
      unitPrice: price,
      total: price,
    }]);
    setGuestName("");
  }

  function updateQuantity(productId: string, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total: newQty * i.unitPrice };
    }));
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const tax = subtotal * 0.19;
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

    const allItems = cart.map(i => ({
      productId: i.product.id.startsWith("virtual-") ? undefined : i.product.id,
      productName: i.product.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: allItems,
        paymentMethod,
        paidAmount: paymentMethod === "CASH" ? Number(paidAmount) : total,
        discount: 0,
        notes: `Cliente: ${customerName} - NIT: ${customerNit}`,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setToast({ message: err.error || "Error al procesar venta", type: "error" });
      return;
    }

    const membershipItems = cart.filter(i => i.product.id.startsWith("virtual-membership-"));
    const dayPassItems = cart.filter(i => i.product.id.startsWith("virtual-daypass-"));

    for (const item of membershipItems) {
      const planId = item.product.id.replace("virtual-membership-", "");
      if (selectedMemberId) {
        await fetch("/api/membership-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create-membership",
            memberId: selectedMemberId,
            planId,
            paymentMethod,
            paidAmount: Number(item.total),
          }),
        });
      }
    }

    for (const _item of dayPassItems) {
      await fetch("/api/day-passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberId || undefined,
          guestName: guestName || customerName,
          price: Number(dayPassPrice),
          paymentMethod,
        }),
      });
    }

    setCart([]);
    setShowPayment(false);
    setPaidAmount("");
    setCustomerName("Consumidor Final");
    setCustomerNit("222222222");
    setSelectedMemberId(null);
    loadProducts();
    setToast({ message: "Venta registrada y facturada", type: "success" });
  }

  if (!cashSession) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-slate-500" />
        <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-300">Caja cerrada</h2>
        <p className="text-slate-400 dark:text-slate-400">Debe abrir la caja para comenzar a vender</p>
        <button onClick={() => setShowCashOpen(true)} className="btn-primary text-lg px-8 py-3">Abrir Caja</button>
        <Modal open={showCashOpen} onClose={() => setShowCashOpen(false)} title="Abrir Caja" size="sm">
          <form onSubmit={openCashRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto Inicial</label>
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

  const isGym = companyType === "GYM";
  const tabs: { id: PosTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "products", label: "Productos", icon: ShoppingCart },
    ...(isGym ? [
      { id: "memberships" as PosTab, label: "Membresías", icon: Dumbbell },
      { id: "daypasses" as PosTab, label: "Pases del Día", icon: Ticket },
    ] : []),
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-120px)] min-h-[calc(100vh-120px)]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex-1 flex flex-col min-w-0 order-1">
        {isGym && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === t.id ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "products" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto o escanear código..." className="w-full sm:w-auto sm:min-w-[300px] sm:flex-1" />
              <select className="input-field w-full sm:w-auto" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                <option value="">Todas</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[200px]">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.filter(p => Number(p.stock) > 0).map(p => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="bg-white dark:bg-[#141925] rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-violet-300 hover:shadow-card transition-all">
                    <p className="font-medium text-slate-900 dark:text-white text-sm truncate text-balance">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">{p.category?.name}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-violet-600">{formatCurrency(Number(p.salePrice))}</span>
                      <span className="text-xs text-slate-400">Stock: {Number(p.stock).toFixed(0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "memberships" && (
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Buscar miembro</label>
              <SearchInput value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Nombre o email del miembro..." className="w-full" />
              {gymMembers.length > 0 && memberSearch.length >= 2 && (
                <div className="mt-1 bg-white dark:bg-[#141925] border border-slate-200 dark:border-slate-800 rounded-xl max-h-32 overflow-y-auto">
                  {gymMembers.map(m => (
                    <button key={m.id} onClick={() => { setSelectedMemberId(m.id); setMemberSearch(m.customer.name); setGymMembers([]); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.03] ${selectedMemberId === m.id ? "bg-violet-50 dark:bg-violet-500/10" : ""}`}>
                      {m.customer.name} {m.customer.email ? `- ${m.customer.email}` : ""}
                    </button>
                  ))}
                </div>
              )}
              {selectedMemberId && <p className="text-xs text-green-600 mt-1">Miembro seleccionado</p>}
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Planes disponibles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.filter(p => Boolean((p as unknown as Record<string, unknown>).isActive !== false)).map(plan => (
                <button key={plan.id} onClick={() => { if (selectedMemberId) addPlanToCart(plan); else setToast({ message: "Seleccione un miembro primero", type: "error" }); }}
                  className="bg-white dark:bg-[#141925] rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-violet-300 hover:shadow-card transition-all">
                  <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{plan.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{plan.durationDays} días</p>
                  <p className="text-lg font-bold text-violet-600 mt-2">{formatCurrency(Number(plan.price))}</p>
                  {plan.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{plan.description}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "daypasses" && (
          <div className="flex-1">
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Miembro (opcional)</label>
                <SearchInput value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Buscar miembro..." className="w-full" />
                {gymMembers.length > 0 && memberSearch.length >= 2 && (
                  <div className="mt-1 bg-white dark:bg-[#141925] border border-slate-200 dark:border-slate-800 rounded-xl max-h-32 overflow-y-auto">
                    {gymMembers.map(m => (
                      <button key={m.id} onClick={() => { setSelectedMemberId(m.id); setMemberSearch(m.customer.name); setGymMembers([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                        {m.customer.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del invitado (si no es miembro)</label>
                <input className="input-field" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Nombre..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Precio del pase</label>
                <input type="number" className="input-field" value={dayPassPrice} onChange={e => setDayPassPrice(e.target.value)} />
              </div>
              <button onClick={addDayPassToCart} className="btn-primary w-full flex items-center justify-center gap-2">
                <Ticket className="w-4 h-4" /> Agregar Pase al Carrito
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-full lg:w-96 bg-white dark:bg-[#141925] rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-card order-2 lg:order-2 shrink-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Carrito ({cart.length})
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-400 text-center py-12">Agrega productos al carrito</p>
          ) : cart.map(item => (
            <div key={item.product.id} className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-900 dark:text-white flex-1">{item.product.name}</p>
                <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                {!item.product.id.startsWith("virtual-") ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-600">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center hover:bg-violet-200 dark:hover:bg-violet-500/15 text-violet-600 dark:text-violet-400">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">{item.product.category?.name}</span>
                )}
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400"><span>IVA (19%)</span><span>{formatCurrency(tax)}</span></div>
          <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800"><span>Total</span><span>{formatCurrency(total)}</span></div>
          <button onClick={() => { setShowPayment(true); setPaidAmount(total.toFixed(2)); }} disabled={cart.length === 0}
            className="btn-success w-full py-3 text-lg mt-3 flex items-center justify-center gap-2">
            <CreditCard className="w-5 h-5" /> Cobrar
          </button>
        </div>
      </div>

      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Procesar Pago" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Cliente</label>
              <input className="input-field" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIT</label>
              <input className="input-field" value={customerNit} onChange={e => setCustomerNit(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Método de Pago</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { value: "CASH", label: "Efectivo", icon: Banknote },
                { value: "CARD", label: "Tarjeta", icon: CreditCard },
                { value: "TRANSFER", label: "Transferencia", icon: Building2 },
              ].map(m => (
                <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${
                    paymentMethod === m.value ? "border-violet-600 bg-violet-50" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}>
                  <m.icon className={`w-6 h-6 ${paymentMethod === m.value ? "text-violet-600" : "text-slate-400"}`} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-lg font-bold">
              <span>Total a Cobrar</span><span className="text-violet-600">{formatCurrency(total)}</span>
            </div>
            {paymentMethod === "CASH" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto Recibido</label>
                  <input type="number" step="0.01" className="input-field text-xl font-bold text-center"
                    value={paidAmount} onChange={e => setPaidAmount(e.target.value)} autoFocus />
                </div>
                {change >= 0 && Number(paidAmount) > 0 && (
                  <div className="flex justify-between text-xl font-bold text-emerald-600 pt-2">
                    <span>Cambio</span><span>{formatCurrency(change)}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button onClick={() => setShowPayment(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handlePayment} className="btn-success flex-1 py-3 text-lg">Confirmar Pago</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
