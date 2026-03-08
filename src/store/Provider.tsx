"use client";

import { Provider as JotaiProvider } from "jotai";
import { useEffect } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { themeAtom, fetchAuthAtom } from ".";

function ThemeSync() {
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return null;
}

function AuthSync() {
  const fetchAuth = useSetAtom(fetchAuthAtom);
  useEffect(() => { fetchAuth(); }, [fetchAuth]);
  return null;
}

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <JotaiProvider>
      <ThemeSync />
      <AuthSync />
      {children}
    </JotaiProvider>
  );
}
