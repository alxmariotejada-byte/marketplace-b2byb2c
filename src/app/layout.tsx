import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import { getMode } from "@/lib/session";
import { CartCount, CartProvider } from "@/components/cart";
import { ModeToggle } from "@/components/mode-toggle";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LOGIMKT Marketplace · B2B y B2C",
  description: "Marketplace salvadoreño para personas y empresas: electrónica, ropa, alimentos, ferretería, hogar y salud.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const mode = await getMode();
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <CartProvider mode={mode}>
          {mode === "B2B" && (
            <div className="bg-slate-900 py-1.5 text-center text-xs font-medium text-white">
              Modo empresas: precios mayoristas · compra mínima $500 · crédito a 30 días
            </div>
          )}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
                <span className="rounded-lg bg-blue-700 px-2 py-0.5 text-white">LOGI</span>
                <span className="text-orange-500">MKT</span>
              </Link>
              <form action="/catalogo" className="order-3 flex w-full flex-1 sm:order-none sm:w-auto">
                <input
                  name="q"
                  placeholder="Buscar productos, marcas o SKU…"
                  className="w-full rounded-l-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-600"
                />
                <button className="rounded-r-full bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">Buscar</button>
              </form>
              <div className="ml-auto flex items-center gap-4">
                <Suspense>
                  <ModeToggle mode={mode} />
                </Suspense>
                <Link href="/pedido" className="hidden text-sm font-medium text-slate-600 hover:text-blue-700 md:block">
                  Mi pedido
                </Link>
                <Link href="/carrito" className="relative text-2xl" aria-label="Carrito">
                  🛒
                  <CartCount />
                </Link>
              </div>
            </div>
            <nav className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 pb-2 text-sm text-slate-600">
              <Link href="/catalogo" className="whitespace-nowrap hover:text-blue-700">Todo el catálogo</Link>
              {["Electrónica", "Ropa y Accesorios", "Alimentos", "Ferreteria", "Hogar", "Salud", "Servicios Digitales"].map((c) => (
                <Link key={c} href={`/catalogo?cat=${encodeURIComponent(c)}`} className="whitespace-nowrap hover:text-blue-700">
                  {c === "Ferreteria" ? "Ferretería" : c}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="mt-16 border-t border-slate-200 bg-white">
            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                <p className="font-bold text-slate-900">LOGIMKT S.A. de C.V.</p>
                <p className="mt-1">Marketplace B2B y B2C · San Salvador, El Salvador</p>
              </div>
              <div className="flex flex-col gap-1">
                <Link href="/catalogo" className="hover:text-blue-700">Catálogo</Link>
                <Link href="/pedido" className="hover:text-blue-700">Rastrear mi pedido</Link>
                <Link href="/admin" className="hover:text-blue-700">Panel ERP (administración)</Link>
              </div>
              <p className="text-xs text-slate-400">
                Proyecto académico · Logística en Negocios Digitales · UNICAES 2026. Los pagos son simulados.
              </p>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
