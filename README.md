# LOGIMKT · Marketplace B2B/B2C (Módulo C) conectado al ERP/OMS

Este repositorio es la **página web de venta** (marketplace) de LOGIMKT S.A. de C.V.
Es la cara pública del sistema: donde personas y empresas ven el catálogo y compran.
El inventario, las compras a proveedores y la gestión formal de pedidos viven en el
**ERP/OMS** del proyecto ([Marzza01/ERP-Log-stica-](https://github.com/Marzza01/ERP-Log-stica-)),
y esta web se conecta a él por su API.

> Para personas: lee las secciones 1, 2, 6 y 7.
> Para una IA o desarrollador que va a integrar o modificar: lee todo; la sección 4 es el contrato de integración.

---

## 1. Por qué existe esta página web

**Contexto académico.** Proyecto integrador final de *Logística en Negocios Digitales*
(Licenciatura en Negocios Digitales, UNICAES 2026). El caso es LOGIMKT S.A. de C.V., un marketplace
salvadoreño B2B y B2C que operaba con Excel, WhatsApp y correo. El proyecto lo digitaliza con tres módulos:

| Módulo | Responsable | Qué gestiona | Dónde está |
| --- | --- | --- | --- |
| **A · ERP (back office)** | Grupo A | Catálogo maestro de 500 SKUs, stock físico, reservas, WMS, compras y proveedores | Repo del ERP (`MarketplaceERP.Catalog`) |
| **B · OMS (pedidos)** | Grupo B | Ciclo de vida del pedido, pagos, facturación, despacho, devoluciones | Repo del ERP (`MarketplaceERP.Finance`, `/api/ordenes`, `/api/checkout`) |
| **C · Marketplace + Dashboard** | Grupo C | Tienda online B2C/B2B, carrito, checkout, reseñas, seguimiento, KPIs | **Este repositorio** |

**El problema que resuelve esta web:** el cliente necesita un lugar para comprar. El PDF del curso define el
flujo “del clic a la entrega”:

1. El cliente hace clic en *Comprar* en el Marketplace (**C**, esta web).
2. El OMS crea el pedido y verifica stock en tiempo real (**B ↔ A**, el ERP).
3. El sistema reserva el inventario (**A**).
4. Se genera la orden de preparación (**A**).
5. El pedido avanza: Confirmado → En preparación → Listo para envío (**B**).
6. Se asigna transportista y guía (**B**).
7. El cliente ve el seguimiento (**C**, esta web).
8. Se registra la entrega y se actualiza el OTIF (**dashboard**).
9. Se envía encuesta NPS/CSAT (**C**, esta web).
10. Los datos alimentan los KPIs.

Esta web cubre los pasos **1, 7, 9 y 10**, y delega los pasos **2–6** al ERP/OMS cuando la conexión está configurada.
Si no lo está, la web trae su **propio mini-ERP/OMS interno** para que el flujo completo se pueda demostrar sola.

**Requisitos del Módulo C cubiertos** (semana 4 del curso): 500 productos publicados (474 activos según el Excel),
buscador con filtros por categoría, precio y disponibilidad, vista B2B con precios diferenciados y mínimo de $500,
carrito, checkout con 3 métodos de pago, reseñas y calificaciones, categorías y banners, y evidencia de compras de prueba.

---

## 2. Qué hace la web (funciones)

| Ruta | Para quién | Qué hace |
| --- | --- | --- |
| `/` | Cliente | Portada: promesa de entrega, categorías, más vendidos, comparativa de precios persona vs empresa |
| `/catalogo` | Cliente | Búsqueda y filtros (texto, categoría, subcategoría, precio, solo disponibles, orden) |
| `/producto/[sku]` | Cliente | Ficha con precio según modo, stock, peso/medidas, código EAN-13, reseñas |
| `/carrito`, `/checkout` | Cliente | Carrito en el navegador; checkout con 3 métodos de pago simulados por tipo de cliente |
| `/politicas`, `/politicas/[tema]` | Cliente | Políticas: términos, pedidos y stock, pagos, envíos, cancelaciones, devoluciones, privacidad (texto en `src/lib/policies.ts`, cifras tomadas de `shared.ts`) |
| `/pedido/[codigo]` | Cliente | Seguimiento del pedido, línea de tiempo, guía, estado en el ERP, encuesta NPS |
| `/admin` | Operación | Dashboard de 8 KPIs con semáforo |
| `/admin/pedidos` | Operación | OMS interno: avanzar estados, cancelar, devolver |
| `/admin/inventario` | Operación | Inventario interno, alertas de stock mínimo, recepciones, carga masiva Excel/CSV |
| `/admin/erp` | Operación | **Conexión con el ERP**: probar, sincronizar catálogo/stock, ver y reenviar pedidos |

**Modo de cliente.** Arriba se elige “Compro para: Mi casa” (B2C) o “Mi empresa” (B2B). Se guarda en la cookie `modo`.
B2C usa `PrecioB2C`, mínimo $5, envío $3.50 (gratis desde $50), pagos: tarjeta, transferencia, contra entrega.
B2B usa `PrecioB2B`, mínimo $500, envío incluido, pagos: crédito 30 días, transferencia, tarjeta corporativa.
Los pagos son **simulados** en la tienda.

---

## 3. Arquitectura

```
                       ┌──────────────────────────── Esta web (Next.js 16, Vercel) ───────────────────────────┐
 Navegador del cliente │  Páginas (src/app)  ──►  API /api/orders  ──►  src/lib/orders.ts  (OMS interno)       │
                       │        │                                         │                                      │
                       │        ▼                                         ▼                                      │
                       │  src/lib/products.ts                     Postgres propio de la tienda (Neon)             │
                       │                                          products · orders · order_items · ...         │
                       │                                                  ▲                                      │
                       │  src/lib/erp-sync.ts  ◄──── src/lib/erp.ts (cliente HTTP + JWT) ────────────────┐        │
                       └──────────────────────────────────────────────────────────────────────────────────┼────────┘
                                                                                                          │ HTTPS + Bearer JWT
                       ┌──────────────────────────── ERP/OMS (ASP.NET Core 8, Render) ────────────────────▼────────┐
                       │  /api/auth/login · /api/productos · /api/checkout/v2/comprar · /api/ordenes/{id}         │
                       │  Postgres del ERP (Neon): catalog.productos, catalog.stock_fisico, finance.ordenes ...   │
                       └──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Dos bases de datos separadas.** La tienda nunca escribe en la base del ERP. Solo habla con el ERP por HTTP.
- **La tienda tiene su copia local** de productos y pedidos (para mostrar rápido, para el dashboard y para funcionar
  aunque el ERP esté caído). El ERP es la **fuente de verdad** de catálogo, stock y estado formal del pedido cuando está conectado.
- **Clave de enlace entre sistemas: el SKU.** `products.sku` (tienda) = `Producto.Sku` (ERP), formato `SKU-00001`…`SKU-00500`.
  Al sincronizar, la tienda guarda el `Id` (GUID) del ERP en `products.erp_id`, que es lo que exige el checkout del ERP.

### Stack

- Next.js 16 (App Router, React 19, Turbopack), TypeScript, Tailwind CSS 4.
- Postgres: Neon en producción (`pg`); si no hay `DATABASE_URL`, PGlite embebido en `.data/` (modo local sin configuración).
- `exceljs` para la carga masiva del catálogo.

---

## 4. Contrato de integración con el ERP/OMS (detalle técnico)

Código: `src/lib/erp.ts` (cliente HTTP) y `src/lib/erp-sync.ts` (lógica de sincronización). API del ERP:
`MarketplaceERP.API` en el repo del ERP. Todas las respuestas del ERP vienen en camelCase (System.Text.Json por defecto).

### 4.1 Autenticación

```
POST {ERP_API_URL}/api/auth/login
Content-Type: application/json
{ "email": "<ERP_EMAIL>", "password": "<ERP_PASSWORD>" }

200 → { "token": "<JWT>", "role": "Comprador|Admin|Vendedor", "expiresAt": "<ISO>", ... }
401 → { "mensaje": "Credenciales inválidas." }
```

- El token se guarda en memoria por usuario y se renueva 1 minuto antes de `expiresAt` o ante un 401.
- Se envía como `Authorization: Bearer <JWT>`.
- Dos usuarios posibles:
  - `ERP_EMAIL` / `ERP_PASSWORD` → rol **Comprador**. Necesario para crear pedidos (`[Authorize(Roles = "Comprador")]`).
  - `ERP_ADMIN_EMAIL` / `ERP_ADMIN_PASSWORD` → rol **Admin** (opcional). Solo un Admin ve `PrecioB2B` y cantidades de stock
    en `/api/productos`. Si no se configura, la sincronización usa el Comprador y conserva el stock local.
- La contraseña es la **de inicio de sesión en texto**, no el hash guardado en la base del ERP.

### 4.2 Catálogo y stock: ERP → tienda

Disparo: botón **Sincronizar catálogo y stock** en `/admin/erp` (función `syncCatalogFromErp`).

```
GET {ERP_API_URL}/api/productos?pagina=N&tamano=500&orden=sku     (pagina 1..N hasta cubrir "total")
200 → { "total": 500, "pagina": 1, "tamano": 500, "items": [ Producto ] }
```

Campos usados de cada `Producto` y cómo se mapean a la tabla `products` de la tienda:

| ERP (`items[]`) | Tienda (`products`) | Regla |
| --- | --- | --- |
| `sku` | `sku` | Llave de emparejamiento. SKUs del ERP que no existen en la tienda se ignoran |
| `id` (GUID) | `erp_id` | Se guarda para poder comprar en el ERP |
| `precioB2C` | `price_b2c` | Se actualiza si es > 0 |
| `precioB2B` (solo Admin) | `price_b2b` | Se actualiza si viene y es > 0 |
| `stock.cantidadDisponible` o `cantidadTotal − cantidadReservada − cantidadBloqueada` (solo Admin) | `stock` | Si no viene (Comprador), se conserva el stock local |
| `imagenUrl` | `image_url` | Si viene con valor, reemplaza la ilustración; si viene vacío, se conserva la actual |
| `estaPublicado` y `estadoProducto == "Activo"` | `status` (`Activo`/`Inactivo`) | Inactivo = no se muestra en la tienda |

Además se marca `erp_synced_at = now()` y se registra el resultado en `erp_sync_log`.

### 4.3 Pedidos: tienda → OMS del ERP

1. El navegador llama `POST /api/orders` (tienda). `createOrder` en `src/lib/orders.ts` valida, bloquea filas
   (`SELECT … FOR UPDATE`), descuenta stock local, crea el pedido `LMK-000001` y responde al cliente.
2. Después de responder (`after()` de Next.js), `pushOrderToErp(code)` envía el pedido al ERP:

```
POST {ERP_API_URL}/api/checkout/v2/comprar
Authorization: Bearer <JWT del Comprador>
Idempotency-Key: LOGIMKT-LMK-000001           (regex del ERP: ^[A-Za-z0-9_-]{8,128}$)
Content-Type: application/json
{ "items": [ { "productoId": "<erp_id GUID>", "cantidad": 2 }, ... ] }

200 → { "ordenId": "<GUID>", "transaccionId": "...", "montoVendedor": ..., "montoMarketplace": ... }
409 → { "tipo": "StockInsuficiente" | "CatalogoNoApto", "mensaje": "..." }
503 → { "tipo": "PagosDeshabilitados", "mensaje": "La pasarela de pagos está deshabilitada." }
```

- El ERP define precio, comprador (el usuario del token) e IVA; reserva stock y procesa el pago en su pasarela.
- Con el `ordenId` la tienda llama `GET /api/ordenes/{ordenId}` para obtener `numeroOrden` y `estado`, y guarda en `orders`:
  `erp_order_id`, `erp_order_number`, `erp_status`. Agrega un evento al historial del pedido.
- Si falla (credenciales, SKU sin `erp_id`, sin stock, pagos deshabilitados, timeout), **la compra no se pierde**:
  queda en la tienda con `erp_error` = mensaje exacto, y se reenvía desde `/admin/erp` → **Enviar al ERP**.
  Reenviar usa la misma `Idempotency-Key`, así el ERP no duplica la orden.
- Hoy todos los pedidos (B2C y B2B) se envían con el mismo usuario Comprador, porque el checkout v2 del ERP toma el
  comprador del token. Si el ERP agrega un endpoint B2B o permite indicar el comprador, este es el punto a cambiar
  (`erpCreateOrder` en `src/lib/erp.ts`).

### 4.4 Estado del pedido: OMS → tienda

En cada visita a `/pedido/[codigo]`, `refreshErpOrder(code)` consulta:

```
GET {ERP_API_URL}/api/ordenes/{erp_order_id}     (roles Admin o Comprador dueño)
200 → { "id", "numeroOrden", "estado", "transportista", "guiaEnvio", "fechaEntregaEstimada", "fechaEntregaReal", ... }
```

y muestra “Registrado en el ERP como `numeroOrden`, estado `estado`, guía `guiaEnvio`”. Estados del OMS del ERP:
`Pendiente → Aprobada → EnProceso → Enviada → Entregada` (o `Cancelada`).

### 4.5 Requisitos del lado del ERP

- Pasarela de pagos **habilitada** (sandbox sirve). Con `Payments:Provider = Disabled` el checkout responde 503.
- Productos **publicados**, `EstadoProducto = "Activo"`, moneda USD y con el **mismo SKU** que el catálogo de la tienda.
- Un usuario **Comprador activo** (y opcionalmente un Admin) creado por un Admin del ERP (`POST /api/usuarios`).
- Render gratuito tarda ~40 s en despertar; el cliente espera hasta 60 s por llamada.
- Usar la URL directa de la API (`https://marketplaceerp-api.onrender.com`). El proxy `https://erp-log-stica.vercel.app/api`
  respondió 401 a llamadas externas.

### 4.6 Ideas para profundizar la integración (pendientes)

- Sincronización automática programada (Vercel Cron → `syncCatalogFromErp`) en vez del botón.
- Webhook del ERP hacia la tienda cuando cambia el estado de una orden (hoy el ERP solo recibe webhooks de la pasarela Wompi; habría que agregar uno de salida).
- Enviar datos de entrega (`DireccionEntrega`, tipo de cliente) si el checkout v2 los acepta.
- Mostrar en el dashboard de la tienda indicadores calculados por el ERP (p. ej. `GET /api/liquidaciones/kpis-vendedores`, rol Admin).

---

## 5. Base de datos de la tienda

Se crea sola al primer uso (`src/lib/schema.ts`, sentencias idempotentes). Tablas:

| Tabla | Para qué |
| --- | --- |
| `products` | Catálogo local (SKU, nombre, categoría, precios B2C/B2B, stock, stock mínimo, proveedor, peso, medidas, EAN, `erp_id`, `image_url`) |
| `orders` | Pedidos `LMK-xxxxxx`: cliente, canal B2C/B2B, pago, totales, costo logístico, estado, guía, fechas, NPS, `erp_*` |
| `order_items` | Líneas: cantidad solicitada vs surtida (alimenta el Fill Rate) |
| `order_events` | Historial de estados (alimenta Lead Time y tiempo de procesamiento) |
| `inventory_movements` | Kardex: carga inicial, ventas, devoluciones, cancelaciones, recepciones, ajustes |
| `reviews` | Reseñas 1–5 estrellas (alimenta CSAT) |
| `erp_sync_log` | Bitácora de sincronizaciones y envíos al ERP |

Si la tabla `products` está vacía, se cargan los 500 SKUs de `data/catalogo.json`
(generado desde `data/Catalogo_500_Productos.xlsx` con `node scripts/excel-a-json.mjs`).

---

## 6. Cómo usar el repositorio

### Verla en tu computadora (sin configurar nada)

1. Instala **Node.js LTS** (20.9 o superior).
2. Windows: doble clic en `iniciar-local.bat`. O en una terminal: `npm install` y luego `npm run dev`.
3. Abre <http://localhost:3000>. Panel: <http://localhost:3000/admin>, contraseña `admin123`.

Sin `DATABASE_URL` usa una base interna en `.data/` (bórrala para empezar de cero). Si cambias estilos y no se ven,
borra la carpeta `.next` y reinicia.

### Variables de entorno

Copia `.env.example` como `.env.local` (local) o defínelas en Vercel:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | En Vercel, sí | Postgres de la tienda (Neon, cadena *pooled*). **No** la base del ERP |
| `ADMIN_PASSWORD` | En Vercel, sí | Contraseña de `/admin` (local: `admin123` por defecto) |
| `ERP_API_URL` | Para conectar | `https://marketplaceerp-api.onrender.com` |
| `ERP_EMAIL`, `ERP_PASSWORD` | Para conectar | Usuario Comprador del ERP |
| `ERP_ADMIN_EMAIL`, `ERP_ADMIN_PASSWORD` | Opcional | Usuario Admin del ERP (stock y precio B2B) |

Nunca subas `.env.local` (está en `.gitignore`).

### Publicar en Vercel conectado al ERP

Paso a paso en **[DESPLIEGUE_ERP.md](DESPLIEGUE_ERP.md)**. Resumen: crear base en Neon → importar repo en Vercel →
poner variables → Deploy → `/admin/erp` → Probar conexión → Sincronizar → hacer una compra y verla en el ERP.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` / `npm start` | Compilar y correr en modo producción |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Revisión de tipos (correr `npx next typegen` antes si falla por `PageProps`) |
| `node scripts/excel-a-json.mjs [archivo.xlsx]` | Regenerar `data/catalogo.json` desde el Excel |

### Mapa de archivos

```
src/
  app/
    page.tsx                 Portada
    catalogo/ producto/ carrito/ checkout/ pedido/   Tienda
    admin/                   Panel: dashboard, pedidos, inventario, erp
    api/orders/route.ts      Crea pedidos (y dispara el envío al ERP)
    api/admin/import/        Carga masiva Excel/CSV
    actions.ts               Server actions (modo, reseñas, NPS, admin, ERP)
  lib/
    db.ts                    Conexión Postgres/PGlite, creación de tablas, carga inicial
    schema.ts                Esquema SQL
    orders.ts                OMS interno: crear, avanzar, cancelar, devolver
    products.ts              Consultas del catálogo
    kpis.ts                  Fórmulas de los 8 KPIs y semáforo
    erp.ts                   Cliente HTTP de la API del ERP (login, catálogo, checkout, órdenes)
    erp-sync.ts              Sincronización ERP ↔ tienda
    catalog-parser.ts        Lectura del Excel/CSV
    shared.ts                Reglas B2B/B2C, métodos de pago, colores de categoría
  components/                Carrito, tarjetas de producto, código de barras EAN-13, selector de modo
data/                        Excel original y catalogo.json
```

### Imágenes de los productos

`src/lib/product-image.ts` decide la imagen de cada producto, en este orden:

1. `products.image_url`: la foto que manda el ERP (campo `imagenUrl` de `/api/productos`, se guarda al sincronizar)
   o la columna `Imagen` / `URL Imagen` del Excel al importar. Si existe, siempre gana.
2. Si no hay foto, una ilustración 3D según el tipo de producto (reglas por nombre y subcategoría), guardada en
   `public/productos/` (Fluent Emoji de Microsoft, licencia MIT). Para regenerarlas:
   `npm pack @lobehub/fluent-emoji-3d && tar xzf lobehub-fluent-emoji-3d-*.tgz && node scripts/imagenes-productos.mjs package/assets`.

Hoy el ERP devuelve `imagenUrl: null`, así que se ven las ilustraciones. Cuando el ERP tenga fotos, aparecerán solas
al sincronizar desde `/admin/erp`.

---

## 7. Guion de prueba (evidencia para el curso)

1. **Mi casa**: compra con **tarjeta** (`4111 1111 1111 1111`).
2. **Mi casa**: compra con **transferencia**.
3. **Mi casa**: compra con **pago contra entrega**.
4. **Mi empresa**: compra de más de $500 con **crédito a 30 días**.
5. **Mi empresa**: compra con **transferencia**.

Luego en `/admin/pedidos` avanza los pedidos hasta **Entregado**, registra una devolución, responde la encuesta
en la página del pedido y revisa `/admin` (KPIs). Con el ERP conectado, revisa `/admin/erp`: cada pedido debe tener
su número de orden del ERP.

### KPIs del dashboard (src/lib/kpis.ts)

| KPI | Fórmula | Meta (verde) |
| --- | --- | --- |
| OTIF | Entregados a tiempo y completos ÷ entregados | ≥ 95% |
| Lead Time | Promedio (entrega − creación) | ≤ 72 h |
| Fill Rate | Unidades surtidas ÷ solicitadas | ≥ 98% |
| Tasa de devoluciones | Devueltos ÷ entregados | ≤ 3% |
| Costo logístico/pedido | Promedio de $2 + $0.25/kg | ≤ $4 |
| Rotación de inventario | Vendidas ÷ inventario promedio, anualizada | ≥ 4/año |
| Tiempo procesamiento OMS | Promedio (Enviado − Recibido) | ≤ 24 h |
| NPS / CSAT | %9-10 − %0-6 · reseñas 4-5★ ÷ total | NPS ≥ 50 · CSAT ≥ 85% |

---

## 8. Notas sobre los datos del catálogo

El Excel trae 24 productos *Inactivo* y 2 con precio $0 (SKU-00485 y SKU-00496), que se importan como inactivos:
la tienda publica **474**. Al conectar el ERP, el estado publicado lo manda el ERP.
