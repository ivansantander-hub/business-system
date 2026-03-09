"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChefHat,
  Clock,
  Check,
  X,
  RefreshCw,
  Utensils,
  Loader2,
} from "lucide-react";
import Toast from "@/components/ui/Toast";
import { Button } from "@/components/atoms";
import PageHeader from "@/components/molecules/PageHeader";

interface OrderItem {
  id: string;
  quantity: string | number;
  status: string;
  notes: string | null;
  product: { name: string };
}

interface Order {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  table: { number: string } | null;
  waiter: { name: string } | null;
  items: OrderItem[];
}

const ITEM_STATUS_NEXT: Record<string, string> = {
  PENDING: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PREPARING: "Preparando",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

function getOrderNumber(id: string): string {
  return id.slice(-6).toUpperCase();
}

function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

export default function CocinaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [openRes, progressRes] = await Promise.all([
        fetch("/api/orders?status=OPEN"),
        fetch("/api/orders?status=IN_PROGRESS"),
      ]);
      const open = openRes.ok ? await openRes.json() : [];
      const progress = progressRes.ok ? await progressRes.json() : [];
      setOrders([...open, ...progress]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function patchOrder(orderId: string, orderStatus: string) {
    setUpdating(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/kitchen`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: orderStatus } : o))
        );
        setToast({ message: "Estado actualizado", type: "success" });
      } else {
        setToast({ message: data?.error || "Error al actualizar", type: "error" });
      }
    } catch {
      setToast({ message: "Error de conexión", type: "error" });
    } finally {
      setUpdating(null);
    }
  }

  async function patchItem(orderId: string, itemId: string, itemStatus: string) {
    setUpdating(itemId);
    try {
      const res = await fetch(`/api/orders/${orderId}/kitchen`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, itemStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              items: o.items.map((i) =>
                i.id === itemId ? { ...i, status: itemStatus } : i
              ),
            };
          })
        );
        setToast({ message: "Item actualizado", type: "success" });
      } else {
        setToast({ message: data?.error || "Error al actualizar", type: "error" });
      }
    } catch {
      setToast({ message: "Error de conexión", type: "error" });
    } finally {
      setUpdating(null);
    }
  }

  function handleItemClick(order: Order, item: OrderItem) {
    if (item.status === "CANCELLED" || item.status === "DELIVERED") return;
    const next = ITEM_STATUS_NEXT[item.status];
    if (next) patchItem(order.id, item.id, next);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ChefHat className="w-5 h-5" />}
        title="Cocina"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchOrders()}
            disabled={loading}
            icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </Button>
        }
      />

      {loading && orders.length === 0 ? (
        <div className="card p-12 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          Cargando órdenes…
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center">
          <Utensils className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-3" />
          <p className="text-slate-600 dark:text-slate-400">No hay órdenes abiertas o en progreso</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order) => {
            const isOpen = order.status === "OPEN";
            const isProgress = order.status === "IN_PROGRESS";
            const borderClass = isOpen
              ? "border-yellow-400/60 dark:border-yellow-500/50"
              : "border-blue-400/60 dark:border-blue-500/50";
            const elapsed = getElapsedMinutes(order.createdAt);

            return (
              <div
                key={order.id}
                className={`card p-4 border-2 ${borderClass} transition-colors`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-lg text-slate-900 dark:text-white">
                      #{getOrderNumber(order.id)}
                    </span>
                    {order.type === "TABLE" && order.table && (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Mesa {order.table.number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm shrink-0">
                    <Clock className="w-4 h-4" />
                    {elapsed} min
                  </div>
                </div>

                {order.waiter && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Mesero: {order.waiter.name}
                  </p>
                )}

                <ul className="space-y-1.5 mb-4">
                  {order.items
                    .filter((i) => i.status !== "CANCELLED")
                    .map((item) => {
                      const isClickable =
                        item.status !== "CANCELLED" && item.status !== "DELIVERED";
                      const isUpdating = updating === item.id;

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => isClickable && handleItemClick(order, item)}
                            disabled={!isClickable}
                            className={`w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg text-sm text-left ${
                            isClickable
                              ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                              : "cursor-default"
                          } ${
                            item.status === "READY"
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
                              : item.status === "PREPARING"
                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
                                : ""
                          }`}
                          >
                            <span className="truncate">
                              {Number(item.quantity)}x {item.product.name}
                            </span>
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            ) : (
                              <span className="text-xs font-medium shrink-0">
                                {ITEM_STATUS_LABELS[item.status]}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                </ul>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  {isOpen && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => patchOrder(order.id, "IN_PROGRESS")}
                      disabled={!!updating}
                      loading={updating === order.id}
                      icon={<Utensils className="w-3.5 h-3.5" />}
                    >
                      En Progreso
                    </Button>
                  )}
                  {isProgress && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => patchOrder(order.id, "READY")}
                      disabled={!!updating}
                      loading={updating === order.id}
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      Listo
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => patchOrder(order.id, "CANCELLED")}
                    disabled={!!updating}
                    loading={updating === order.id}
                    icon={<X className="w-3.5 h-3.5" />}
                  >
                    Rechazar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
