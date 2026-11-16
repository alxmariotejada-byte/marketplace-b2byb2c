import Link from "next/link";
import type { Product } from "@/lib/products";
import { categoryStyle, money, type Channel } from "@/lib/shared";
import { AddToCartButton } from "./cart";

export function ProductVisual({ category, name, size = "md" }: { category: string; name: string; size?: "md" | "lg" }) {
  const s = categoryStyle(category);
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl ${size === "lg" ? "aspect-square text-8xl" : "aspect-[4/3] text-5xl"}`}
      style={{ background: s.bg, color: s.fg }}
      aria-hidden
    >
      <span>{s.icon}</span>
      {size === "lg" && <span className="mt-4 max-w-[80%] text-center text-base font-semibold">{name}</span>}
    </div>
  );
}

export function Stars({ rating, count }: { rating: number | null; count?: number }) {
  if (!rating) return <span className="text-xs text-slate-400">Sin reseñas</span>;
  const full = Math.round(rating);
  return (
    <span className="text-xs text-amber-500" title={`${rating.toFixed(1)} de 5`}>
      {"★".repeat(full)}
      <span className="text-slate-300">{"★".repeat(5 - full)}</span>
      {count !== undefined && <span className="ml-1 text-slate-500">({count})</span>}
    </span>
  );
}

export function StockBadge({ stock, min }: { stock: number; min: number }) {
  if (stock <= 0) return <span className="text-xs font-medium text-red-600">Agotado</span>;
  if (stock <= min) return <span className="text-xs font-medium text-amber-600">¡Últimas {stock} unidades!</span>;
  return <span className="text-xs font-medium text-emerald-700">Disponible ({stock})</span>;
}

export function ProductCard({ p, mode }: { p: Product; mode: Channel }) {
  const price = mode === "B2B" ? p.price_b2b : p.price_b2c;
  const saving = p.price_b2c > 0 ? Math.round((1 - p.price_b2b / p.price_b2c) * 100) : 0;
  return (
    <article className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <Link href={`/producto/${encodeURIComponent(p.sku)}`} className="flex flex-1 flex-col">
        <ProductVisual category={p.category} name={p.name} />
        <p className="mt-3 text-xs text-slate-500">
          {p.category} · {p.subcategory}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-blue-700">{p.name}</h3>
        <Stars rating={p.rating} count={p.reviews} />
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-slate-900">{money(price)}</span>
          {mode === "B2B" && (
            <>
              <span className="text-xs text-slate-400 line-through">{money(p.price_b2c)}</span>
              {saving > 0 && <span className="text-xs font-semibold text-emerald-700">−{saving}%</span>}
            </>
          )}
        </div>
        <div className="mb-3 mt-1">
          <StockBadge stock={p.stock} min={p.stock_min} />
        </div>
      </Link>
      <AddToCartButton
        product={{ sku: p.sku, name: p.name, category: p.category, price_b2c: p.price_b2c, price_b2b: p.price_b2b, stock: p.stock }}
      />
    </article>
  );
}
