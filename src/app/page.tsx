import Link from "next/link";
import { getMode } from "@/lib/session";
import { getBestSellers, getCategories, getFeatured } from "@/lib/products";
import { categoryStyle } from "@/lib/shared";
import { ProductCard } from "@/components/product-card";

export default async function Home() {
  const mode = await getMode();
  const [cats, featured, best] = await Promise.all([getCategories(), getFeatured(8), getBestSellers(4)]);
  const total = cats.reduce((s, c) => s + c.n, 0);

  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* Banners destacados */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 p-8 text-white lg:col-span-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-200">Temporada alta · Nov – Ene</p>
          <h1 className="mt-2 max-w-lg text-3xl font-black leading-tight sm:text-4xl">
            Todo lo que necesitas, entregado en todo El Salvador
          </h1>
          <p className="mt-3 max-w-md text-blue-100">
            {total} productos de 150 vendedores. Compra desde $5 y recibe en 3 días hábiles con seguimiento en tiempo real.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/catalogo" className="rounded-full bg-orange-500 px-6 py-3 font-semibold hover:bg-orange-600">
              Ver catálogo
            </Link>
            <Link href="/catalogo?cat=Electr%C3%B3nica" className="rounded-full bg-white/15 px-6 py-3 font-semibold hover:bg-white/25">
              Ofertas en electrónica
            </Link>
          </div>
          <span className="pointer-events-none absolute -bottom-6 -right-4 text-[10rem] opacity-20">📦</span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-3xl bg-slate-900 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">Para empresas</p>
            <h2 className="mt-1 text-xl font-bold">Precios mayoristas B2B</h2>
            <p className="mt-1 text-sm text-slate-300">Hasta 20% menos, crédito a 30 días y factura de crédito fiscal. Compra mínima $500.</p>
            {mode === "B2C" ? (
              <p className="mt-3 text-sm font-semibold text-orange-300">Activa “Empresas B2B” arriba para ver tus precios.</p>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-300">✓ Estás viendo precios B2B</p>
            )}
          </div>
          <div className="flex-1 rounded-3xl bg-orange-100 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">Envío gratis</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">En compras desde $50</h2>
            <p className="mt-1 text-sm text-slate-700">Paga con tarjeta, transferencia o contra entrega.</p>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Compra por categoría</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {cats.map((c) => {
            const s = categoryStyle(c.category);
            return (
              <Link
                key={c.category}
                href={`/catalogo?cat=${encodeURIComponent(c.category)}`}
                className="rounded-2xl p-4 text-center transition hover:-translate-y-0.5 hover:shadow"
                style={{ background: s.bg, color: s.fg }}
              >
                <div className="text-4xl">{s.icon}</div>
                <p className="mt-2 text-sm font-semibold">{c.category === "Ferreteria" ? "Ferretería" : c.category}</p>
                <p className="text-xs opacity-75">{c.n} productos</p>
              </Link>
            );
          })}
        </div>
      </section>

      {best.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Más vendidos</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {best.map((p) => <ProductCard key={p.sku} p={p} mode={mode} />)}
          </div>
        </section>
      )}

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">Productos destacados</h2>
          <Link href="/catalogo" className="text-sm font-semibold text-blue-700 hover:underline">Ver todos →</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.sku} p={p} mode={mode} />)}
        </div>
      </section>

      <section className="mt-12 grid gap-4 rounded-3xl bg-white p-6 text-sm shadow-sm sm:grid-cols-4">
        {[
          ["🚚", "Entrega en 3 días", "A todo El Salvador"],
          ["📍", "Rastreo en tiempo real", "Del clic a tu puerta"],
          ["🔒", "Pago seguro", "3 métodos de pago"],
          ["↩️", "Devoluciones fáciles", "Reembolso garantizado"],
        ].map(([i, t, d]) => (
          <div key={t} className="flex items-center gap-3">
            <span className="text-3xl">{i}</span>
            <div>
              <p className="font-semibold">{t}</p>
              <p className="text-slate-500">{d}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
