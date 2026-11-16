# Despliegue del Marketplace LOGIMKT conectado al ERP

Guía para publicar esta tienda (Módulo C) en Vercel y conectarla al ERP/OMS de
[Marzza01/ERP-Log-stica-](https://github.com/Marzza01/ERP-Log-stica-).

## 1. Base de datos de la tienda (Neon)

La tienda guarda su propio carrito, pedidos, reseñas y encuestas en Postgres.

1. En Neon crea una base nueva (puede ser un proyecto aparte o una base `marketplace` dentro del mismo proyecto; **no uses la base del ERP**, la tienda crea sus propias tablas `products`, `orders`, etc.).
2. Copia la cadena **pooled** (`postgresql://...-pooler...?sslmode=require`).

Las tablas se crean solas en la primera petición y se cargan los 500 SKUs de `data/catalogo.json`.

## 2. Proyecto en Vercel

1. **Add New → Project** e importa este repositorio (framework Next.js, sin cambiar comandos).
2. Variables de entorno (Production y Preview):

| Variable | Obligatoria | Valor |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena pooled de Neon del paso 1 |
| `ADMIN_PASSWORD` | Sí | Contraseña del panel `/admin` de la tienda |
| `ERP_API_URL` | Para conectar | `https://marketplaceerp-api.onrender.com` (la API directa; el proxy de `erp-log-stica.vercel.app/api` respondió 401 desde fuera) |
| `ERP_EMAIL` / `ERP_PASSWORD` | Para conectar | Usuario del ERP con rol **Comprador** (contraseña en texto, no el hash) |
| `ERP_ADMIN_EMAIL` / `ERP_ADMIN_PASSWORD` | Opcional | Usuario con rol **Admin**: al sincronizar trae también stock disponible y `PrecioB2B` |

3. **Deploy**.

## 3. Activar la conexión

1. Entra a `https://<tu-tienda>.vercel.app/admin` con `ADMIN_PASSWORD`.
2. Pestaña **Conexión ERP** → **Probar conexión** (hace `POST /api/auth/login` y `GET /api/productos`).
3. **Sincronizar catálogo y stock**: empareja por `Sku` y guarda el `Id` (GUID) del producto del ERP; actualiza `PrecioB2C`, `PrecioB2B`, stock disponible (`CantidadTotal − Reservada − Bloqueada`) y estado publicado. Repite cuando cambie el inventario del ERP.
4. Haz una compra en la tienda. Después de responder al cliente, la tienda llama a
   `POST /api/checkout/v2/comprar` con `Idempotency-Key: LOGIMKT-LMK-xxxxxx` y
   `{ "items": [{ "productoId": "<guid>", "cantidad": n }] }` usando el token del Comprador.
5. En **Conexión ERP** verás el número de orden del ERP o el error exacto, con un botón para reenviar.
   La página pública del pedido (`/pedido/LMK-xxxxxx`) consulta `GET /api/ordenes/{id}` y muestra estado y guía.

## Requisitos del lado del ERP

- **Pasarela de pagos habilitada** (sandbox está bien). Con `Payments:Provider = Disabled`, el checkout v2 responde 503 `PagosDeshabilitados` y el pedido queda solo en la tienda.
- Los productos deben estar **publicados** y con el **mismo SKU** que el catálogo (`SKU-00001` … `SKU-00500`).
- Render gratuito tarda ~40 s en despertar; la tienda espera hasta 60 s por llamada.
- El checkout v2 del ERP es B2C (precio y comprador los define el servidor del ERP). Los pedidos B2B de la tienda se envían por la misma vía con el usuario Comprador configurado.

## Sin ERP

Si las variables `ERP_*` no están, la tienda funciona sola con su inventario y su OMS internos (todo el flujo del PDF se puede demostrar igual).
