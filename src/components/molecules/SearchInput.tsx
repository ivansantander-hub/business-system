/**
 * SearchInput - Input with search icon.
 *
 * @level Molecule
 * @composition Input
 * @example
 * <SearchInput value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar productos…" />
 */

"use client";

import { Search, X } from "lucide-react";
import Input from "../atoms/Input";

export interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({ value, onChange, onClear, placeholder = "Buscar…", className = "" }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-10 pr-9"
        type="search"
        autoComplete="off"
      />
      {value && onClear && (
        <button
          onClick={onClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
