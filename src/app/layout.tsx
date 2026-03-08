import type { Metadata } from "next";
import StoreProvider from "@/store/Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SGC — Sistema de Gestión Comercial",
  description: "Sistema integral de facturación, inventarios y contabilidad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0a0e1a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      </head>
      <body className="antialiased font-sans" style={{ touchAction: "manipulation" }}>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
