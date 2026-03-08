"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Eye, XCircle, Printer, Download } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/molecules";

interface Invoice {
  id: string; number: string; date: string; subtotal: string; tax: string; taxRate: string;
  discount: string; total: string; paidAmount: string; changeAmount: string;
  paymentMethod: string; status: string; notes: string | null; createdAt: string;
  customer: { name: string; nit: string | null } | null;
  user: { name: string };
  items: { id: string; productName: string; quantity: string; unitPrice: string; total: string }[];
}

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDetail, setShowDetail] = useState<Invoice | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const res = await fetch(`/api/invoices?${params}`);
    if (res.ok) {
      setInvoices(await res.json());
    } else {
      setInvoices([]);
    }
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  async function cancelInvoice(id: string) {
    if (!confirm("¿Anular esta factura? Se restaurará el inventario.")) return;
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) {
      setShowDetail(null); load();
      setToast({ message: "Factura anulada", type: "success" });
    }
  }

  const statusColors: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const statusLabels: Record<string, string> = { PAID: "Pagada", PENDING: "Pendiente", CANCELLED: "Anulada" };
  const paymentLabels: Record<string, string> = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", CREDIT: "Crédito" };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageHeader icon={<FileText className="w-full h-full" />} title="Facturas" />

      <div className="card">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-4">
          <select className="input-field w-full sm:w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="PAID">Pagada</option><option value="PENDING">Pendiente</option><option value="CANCELLED">Anulada</option>
          </select>
          <input type="date" className="input-field w-full sm:w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="input-field w-full sm:w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>

        {invoices.length === 0 ? (
          <EmptyState icon={<FileText className="w-7 h-7" />} title="Sin facturas" />
        ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="table-header rounded-l-lg">Número</th><th className="table-header hidden sm:table-cell">Cliente</th><th className="table-header hidden md:table-cell">Pago</th>
                <th className="table-header text-right">Total</th><th className="table-header hidden sm:table-cell">Estado</th>
                <th className="table-header hidden sm:table-cell">Fecha</th><th className="table-header rounded-r-lg">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <td className="table-cell font-medium truncate max-w-[100px]">{inv.number}</td>
                  <td className="table-cell hidden sm:table-cell truncate max-w-[120px]">{inv.customer?.name || "C/F"}</td>
                  <td className="table-cell hidden md:table-cell">{paymentLabels[inv.paymentMethod]}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(inv.total)}</td>
                  <td className="table-cell hidden sm:table-cell"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[inv.status]}`}>{statusLabels[inv.status]}</span></td>
                  <td className="table-cell hidden sm:table-cell">{formatDate(inv.date)}</td>
                  <td className="table-cell">
                    <button onClick={() => setShowDetail(inv)} className="p-1.5 hover:bg-violet-100 dark:hover:bg-violet-500/10 rounded-lg" title="Ver detalle"><Eye className="w-4 h-4 text-violet-600 dark:text-violet-400" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail ? `Factura ${showDetail.number}` : ""} size="lg">
        {showDetail && (
          <div className="space-y-4" id="invoice-print">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500 dark:text-slate-400">Cliente: <span className="font-medium text-slate-900 dark:text-white">{showDetail.customer?.name || "Consumidor Final"}</span></p>
                <p className="text-slate-500 dark:text-slate-400">NIT: <span className="font-medium">{showDetail.customer?.nit || "CF"}</span></p></div>
              <div className="text-right"><p className="text-slate-500 dark:text-slate-400">Fecha: <span className="font-medium">{formatDate(showDetail.date)}</span></p>
                <p className="text-slate-500 dark:text-slate-400">Pago: <span className="font-medium">{paymentLabels[showDetail.paymentMethod]}</span></p></div>
            </div>

            <table className="w-full">
              <thead><tr><th className="table-header">Producto</th><th className="table-header text-right">Cant</th><th className="table-header text-right">P/U</th><th className="table-header text-right">Total</th></tr></thead>
              <tbody>
                {showDetail.items.map(item => (
                  <tr key={item.id}><td className="table-cell">{item.productName}</td><td className="table-cell text-right">{Number(item.quantity).toFixed(0)}</td><td className="table-cell text-right">{formatCurrency(item.unitPrice)}</td><td className="table-cell text-right font-medium">{formatCurrency(item.total)}</td></tr>
                ))}
              </tbody>
            </table>

            <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(showDetail.subtotal)}</span></div>
              {Number(showDetail.discount) > 0 && <div className="flex justify-between text-red-600 dark:text-red-400"><span>Descuento</span><span>-{formatCurrency(showDetail.discount)}</span></div>}
              <div className="flex justify-between"><span>IVA ({(Number(showDetail.taxRate) * 100).toFixed(0)}%)</span><span>{formatCurrency(showDetail.tax)}</span></div>
              <div className="flex justify-between font-bold text-lg border-t dark:border-slate-700 pt-2"><span>Total</span><span>{formatCurrency(showDetail.total)}</span></div>
              {showDetail.paymentMethod === "CASH" && (
                <>
                  <div className="flex justify-between"><span>Recibido</span><span>{formatCurrency(showDetail.paidAmount)}</span></div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium"><span>Cambio</span><span>{formatCurrency(showDetail.changeAmount)}</span></div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3 no-print">
              <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 flex-1"><Printer className="w-4 h-4" /> Imprimir</button>
              <a href={`/api/invoices/${showDetail.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2"><Download className="w-4 h-4" /> PDF</a>
              {showDetail.status !== "CANCELLED" && (
                <button onClick={() => cancelInvoice(showDetail.id)} className="btn-danger flex items-center gap-2"><XCircle className="w-4 h-4" /> Anular</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
