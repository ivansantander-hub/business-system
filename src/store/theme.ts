"use client";

import { atom } from "jotai";

export type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme") as Theme | null;
  if (stored) return stored;
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const themeAtom = atom<Theme>(getInitialTheme());

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
