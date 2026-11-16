import Link from "next/link";
import { notFound } from "next/navigation";
import { getMode } from "@/lib/session";
import { getProduct, getRelated, getReviews } from "@/lib/products";
import { money } from "@/lib/shared";
import { AddToCartButton } from "@/components/cart";
import { ProductCard, ProductVisual, Stars, StockBadge } from "@/components/product-card";
import { addReview } from "@/app/actions";

export default async function ProductPage({ params, searchParams }: PageProps<"/producto/[sku]">) {
  const { sku } = await params;
  const sp = await searchParams;
  const p = await getProduct(decodeURIComponent(sku));
  if (!p || p.status !== "Activo") notFound();
  const mode = await getMode();
  const [reviews, related] = await Promise.all([getReviews(p.sku), getRelated(p)]);
  const price = mode === "B2B" ? p.price_b2b : p.price_b2c;
  const brand = p.description?.split("|")[1]?.trim();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav className="text-sm text-slate-500">
        <Link href="/catalogo" className="hover:text-blue-700">Catálogo</Link> ›{" "}
        <Link href={`/catalogo?cat=${encodeURIComponent(p.category)}`} className="hover:text-blue-700">{p.category}</Link> ›{" "}
        <Link href={`/catalogo?cat=${encodeURIComponent(p.category)}&sub=${encodeURIComponent(p.subcategory ?? "")}`} className="hover:text-blue-700">{p.subcategory}</Link>
      </nav>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <ProductVisual category={p.category} name={p.name} size="lg" />
        <div>
          {brand && <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{brand}</p>}
          <h1 className="mt-1 text-3xl font-bold">{p.name}</h1>
          <div className="mt-2"><Stars rating={p.rating} count={p.reviews} /></div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black">{money(price)}</span>
              <span className="text-sm text-slate-500">por {p.unit?.toLowerCase() ?? "unidad"}</span>
            </div>
            {mode === "B2B" ? (
              <p className="mt-1 text-sm text-emerald-700">
                Precio mayorista B2B · precio al público {money(p.price_b2c)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                ¿Compras para tu empresa? Precio B2B: <strong>{money(p.price_b2b)}</strong> (mínimo $500 por pedido)
              </p>
            )}
            <div className="mt-3"><StockBadge stock={p.stock} min={p.stock_min} /></div>
            <div className="mt-4">
              <AddToCartButton
                withQty
                product={{ sku: p.sku, name: p.name, category: p.category, price_b2c: p.price_b2c, price_b2b: p.price_b2b, stock: p.stock }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">🚚 Entrega estimada: {mode === "B2B" ? "5" : "3"} días hábiles</p>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-white p-5 text-sm">
            {[
              ["SKU", p.sku],
              ["Código EAN", p.ean],
              ["Proveedor", p.supplier],
              ["País de origen", p.origin_country],
              ["Peso", p.weight_kg ? `${p.weight_kg} kg` : null],
              ["Dimensiones", p.length_cm ? `${p.length_cm} × ${p.width_cm} × ${p.height_cm} cm` : null],
            ].map(([k, v]) => v && (
              <div key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Reseñas */}
      <section id="resenas" className="mt-12 grid gap-8 md:grid-cols-[1fr_360px]">
        <div>
          <h2 className="text-2xl font-bold">Opiniones de clientes</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 text-slate-500">Aún no hay reseñas. ¡Sé el primero en opinar!</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.author}</span>
                    <Stars rating={r.rating} />
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-slate-700">{r.comment}</p>}
                  <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("es-SV")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form action={addReview} className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <h3 className="text-lg font-semibold">Califica este producto</h3>
          {sp.resena === "ok" && <p className="rounded-lg bg-emerald-50 p-2 text-emerald-700">¡Gracias por tu reseña!</p>}
          {sp.resena === "error" && <p className="rounded-lg bg-red-50 p-2 text-red-700">Completa tu nombre y la calificación.</p>}
          <input type="hidden" name="sku" value={p.sku} />
          <input name="author" required maxLength={60} placeholder="Tu nombre" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <select name="rating" required defaultValue="5" className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="5">★★★★★ Excelente</option>
            <option value="4">★★★★ Muy bueno</option>
            <option value="3">★★★ Regular</option>
            <option value="2">★★ Malo</option>
            <option value="1">★ Muy malo</option>
          </select>
          <textarea name="comment" rows={3} maxLength={1000} placeholder="Cuéntanos tu experiencia (opcional)" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          <button className="w-full rounded-lg bg-blue-700 py-2 font-semibold text-white hover:bg-blue-800">Publicar reseña</button>
        </form>
      </section>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">También te puede interesar</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((r) => <ProductCard key={r.sku} p={r} mode={mode} />)}
          </div>
        </section>
      )}
    </div>
  );
}
