"use client";

import { atom } from "jotai";

export type Theme = "light" | "dark";

export const themeAtom = atom<Theme>("dark");

export const themeHydratedAtom = atom(false);

export const hydrateThemeAtom = atom(null, (get, set) => {
  if (typeof window === "undefined") return;
  if (get(themeHydratedAtom)) return;

  const stored = localStorage.getItem("theme") as Theme | null;
  const resolved = stored || (globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  set(themeAtom, resolved);
  set(themeHydratedAtom, true);

  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
});

export const toggleThemeAtom = atom(null, (get, set) => {
  const next = get(themeAtom) === "dark" ? "light" : "dark";
  set(themeAtom, next as Theme);
  if (typeof window !== "undefined") {
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    localStorage.setItem("theme", next);
  }
});
