"use client";

import { atom } from "jotai";

export interface CompanyOption {
  id: string;
  name: string;
  role: string;
}

export interface AuthUser {
  name: string;
  role: string;
  companyId: string | null;
  companyName?: string;
  companyType?: string;
  companies?: CompanyOption[];
  permissions?: string[];
}

export const authUserAtom = atom<AuthUser | null>(null);
export const authLoadingAtom = atom(true);

export const fetchAuthAtom = atom(null, async (_get, set) => {
  try {
    set(authLoadingAtom, true);
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      set(authUserAtom, data);
    } else {
      set(authUserAtom, null);
    }
  } catch {
    set(authUserAtom, null);
  } finally {
    set(authLoadingAtom, false);
  }
});

export const userNameAtom = atom((get) => get(authUserAtom)?.name ?? "");
export const userRoleAtom = atom((get) => get(authUserAtom)?.role ?? "");
export const companyIdAtom = atom((get) => get(authUserAtom)?.companyId ?? null);
export const companyTypeAtom = atom((get) => get(authUserAtom)?.companyType ?? "RESTAURANT");
export const permissionsAtom = atom((get) => get(authUserAtom)?.permissions ?? []);
export const companiesAtom = atom((get) => get(authUserAtom)?.companies ?? []);
