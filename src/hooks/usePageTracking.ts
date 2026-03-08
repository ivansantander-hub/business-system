"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { frontendLogger } from "@/lib/frontend-logger";

export function usePageTracking() {
  const pathname = usePathname();
  const lastPath = useRef<string>("");

  useEffect(() => {
    if (pathname && pathname !== lastPath.current) {
      lastPath.current = pathname;
      frontendLogger.pageView(pathname);
    }
  }, [pathname]);
}
