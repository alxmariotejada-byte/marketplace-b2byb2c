// Utilidades que se usan tanto en el servidor como en el navegador.

export type Channel = "B2C" | "B2B";

export const B2B_MIN_ORDER = 500; // compra mínima mayorista ($)
export const B2C_MIN_ORDER = 5; // compra mínima consumidor final ($)
export const B2C_FREE_SHIPPING_FROM = 50;
export const B2C_SHIPPING = 3.5;

export const PAYMENT_METHODS: Record<Channel, { id: string; label: string; hint: string }[]> = {
  B2C: [
    { id: "tarjeta", label: "Tarjeta de crédito o débito", hint: "Pago inmediato (simulado)" },
    { id: "transferencia", label: "Transferencia bancaria", hint: "Se verifica en 24 horas" },
    { id: "contra_entrega", label: "Pago contra entrega", hint: "Pagas en efectivo al recibir" },
  ],
  B2B: [
    { id: "credito_30", label: "Crédito a 30 días", hint: "Para clientes empresariales" },
    { id: "transferencia", label: "Transferencia bancaria", hint: "Se verifica en 24 horas" },
    { id: "tarjeta", label: "Tarjeta corporativa", hint: "Pago inmediato (simulado)" },
  ],
};

export function money(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORY_STYLES: { match: RegExp; icon: string; bg: string; fg: string }[] = [
  { match: /electr/i, icon: "💻", bg: "#dfe8f6", fg: "#0b3d91" },
  { match: /ropa|accesor/i, icon: "👕", bg: "#f4e3e6", fg: "#9b2c45" },
  { match: /aliment|bebida/i, icon: "🥫", bg: "#f6ead3", fg: "#8a5a12" },
  { match: /ferret|industr/i, icon: "🔧", bg: "#e4e6ea", fg: "#38404d" },
  { match: /hogar|decor/i, icon: "🛋️", bg: "#dcefe7", fg: "#1f6b55" },
  { match: /salud|cuidado/i, icon: "💊", bg: "#dcf0f2", fg: "#16697a" },
  { match: /servicio|digital/i, icon: "☁️", bg: "#e7e3f5", fg: "#4c3d8f" },
];

export function categoryStyle(category: string) {
  return CATEGORY_STYLES.find((s) => s.match.test(category)) ?? { icon: "📦", bg: "#f1f5f9", fg: "#334155" };
}

export const ORDER_FLOW = ["Recibido", "Confirmado", "En preparación", "Enviado", "Entregado", "Cerrado"] as const;

export function statusColor(status: string): string {
  switch (status) {
    case "Recibido":
    case "Confirmado":
      return "bg-blue-100 text-blue-800";
    case "En preparación":
      return "bg-amber-100 text-amber-800";
    case "Enviado":
      return "bg-indigo-100 text-indigo-800";
    case "Entregado":
    case "Cerrado":
      return "bg-emerald-100 text-emerald-800";
    case "Devuelto":
      return "bg-orange-100 text-orange-800";
    case "Cancelado":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}
