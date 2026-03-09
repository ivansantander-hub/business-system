"use client";

import { atom } from "jotai";
import { authUserAtom } from "./auth";

export interface BranchOption {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  isActive: boolean;
  userCount?: number;
}

export const branchesAtom = atom<BranchOption[]>([]);
export const selectedBranchAtom = atom<string | null>((get) => get(authUserAtom)?.branchId ?? null);
