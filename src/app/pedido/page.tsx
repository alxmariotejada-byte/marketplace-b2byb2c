import { findOrder } from "@/app/actions";

export default function BuscarPedido() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Rastrea tu pedido</h1>
      <p className="mt-1 text-sm text-slate-500">Escribe el número que recibiste al comprar, por ejemplo LMK-000001.</p>
      <form action={findOrder} className="mt-6 flex gap-2">
        <input name="code" required placeholder="LMK-000001" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 uppercase" />
        <button className="rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">Buscar</button>
      </form>
    </div>
  );
}
