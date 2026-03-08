/**
 * ConfirmDialog - Confirmation modal for destructive actions.
 *
 * @level Molecule
 * @composition Button, Modal
 * @example
 * <ConfirmDialog open={show} onConfirm={handleDelete} onCancel={() => setShow(false)} title="Eliminar" />
 */

"use client";

import { AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../atoms/Button";

export interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  loading?: boolean;
}

export default function ConfirmDialog({
  open, onConfirm, onCancel, title = "Confirmar acción",
  message = "Esta acción no se puede deshacer.", confirmLabel = "Confirmar", loading
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">{message}</p>
        <div className="flex gap-3 w-full">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
