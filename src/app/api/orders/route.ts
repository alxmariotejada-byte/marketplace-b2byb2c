import { NextResponse } from "next/server";
import { createOrder, OrderError, type OrderInput } from "@/lib/orders";

// API del OMS: el Marketplace envía aquí el carrito y el OMS crea el pedido contra el inventario del ERP.
export async function POST(req: Request) {
  let body: OrderInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  try {
    const result = await createOrder(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("Error al crear pedido", e);
    return NextResponse.json({ error: "No se pudo crear el pedido. Intenta de nuevo." }, { status: 500 });
  }
}
