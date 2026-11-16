# LOGIMKT · Marketplace B2B/B2C + ERP

Proyecto integrador de **Logística en Negocios Digitales (UNICAES 2026)**. Es un marketplace para personas (B2C) y empresas (B2B) conectado a un ERP de inventario y a un OMS de pedidos, con el dashboard de los 8 KPIs logísticos.

## Qué incluye

| Módulo | Qué hace | Dónde está |
| --- | --- | --- |
| **A · ERP** | Catálogo de 500 SKUs (se carga solo desde el Excel), stock en tiempo real, alertas de stock mínimo, recepción de mercancía, ajustes, carga masiva por Excel/CSV, movimientos de inventario | `/admin/inventario` |
| **B · OMS** | Pedidos B2B y B2C, verificación y reserva de stock, estados Recibido → Confirmado → En preparación → Enviado → Entregado → Cerrado, transportista y guía, cancelaciones y devoluciones con reingreso al inventario | `/admin/pedidos` y `/api/orders` |
| **C · Marketplace** | Portada con banners y categorías, buscador con filtros (categoría, subcategoría, precio, disponibilidad), vista B2B con precios mayoristas y mínimo de $500, carrito, checkout con 3 métodos de pago, reseñas, rastreo del pedido y encuesta NPS | `/`, `/catalogo`, `/producto/...`, `/carrito`, `/checkout`, `/pedido` |
| **Dashboard** | OTIF, Lead Time, Fill Rate, tasa de devoluciones, costo logístico por pedido, rotación de inventario, tiempo de procesamiento OMS y NPS/CSAT, con semáforo | `/admin` |

Los pagos son **simulados** (no se cobra nada ni se guarda la tarjeta).

## Tecnología

- **Next.js** (página web y API en el mismo proyecto) → se publica en **Vercel**.
- **PostgreSQL en Neon** → base de datos del ERP y del OMS.
- Las tablas se crean solas y los 500 productos se cargan solos la primera vez que se abre la página.

> No hace falta Render: la API vive dentro del mismo proyecto de Vercel (carpeta `src/app/api`).

## Publicar en internet (paso a paso)

### 1. Crear la base de datos en Neon

1. Entra a <https://neon.tech> e inicia sesión (puedes usar tu cuenta de GitHub).
2. Clic en **New Project**. Nombre: `logimkt`. Región: **AWS US East (N. Virginia)**. Clic en **Create**.
3. En el panel del proyecto, clic en **Connect**. Activa **Connection pooling** y copia la cadena que empieza con `postgresql://...`. Guárdala, la vas a pegar en Vercel.

### 2. Publicar la web en Vercel

1. Entra a <https://vercel.com> e inicia sesión con tu cuenta de GitHub.
2. Clic en **Add New… → Project** y elige el repositorio **marketplace-b2byb2c** → **Import**.
3. Abre **Environment Variables** y agrega dos:
   - `DATABASE_URL` = la cadena de Neon que copiaste.
   - `ADMIN_PASSWORD` = una contraseña para el panel de administración (la que tú quieras).
4. Clic en **Deploy** y espera 1–2 minutos.
5. Abre la dirección que te da Vercel (algo como `https://marketplace-b2byb2c.vercel.app`). La primera carga tarda unos segundos porque crea las tablas y carga los 500 productos.

### 3. Probar

- Tienda: la dirección principal.
- Panel ERP: agrega `/admin` a la dirección y entra con tu `ADMIN_PASSWORD`.

## Guion para las 5 compras de prueba (evidencia)

1. Como **Personas**: compra 1 producto con **tarjeta** (usa `4111 1111 1111 1111`).
2. Como **Personas**: compra con **transferencia bancaria**.
3. Como **Personas**: compra con **pago contra entrega**.
4. Cambia a **Empresas B2B** arriba: compra más de $500 con **crédito a 30 días**.
5. Como **Empresas B2B**: compra con **transferencia**.

Después, en `/admin/pedidos`, avanza los pedidos por cada estado hasta **Entregado**, registra una devolución y responde la encuesta NPS desde la página del pedido. El dashboard `/admin` mostrará los KPIs calculados. Toma captura de cada paso.

## Trabajar en tu computadora (opcional)

```bash
npm install
cp .env.example .env.local   # y pega tu DATABASE_URL de Neon
npm run dev                  # abre http://localhost:3000
```

Si cambias el Excel del catálogo, puedes subirlo desde `/admin/inventario` (carga masiva). Los SKUs nuevos entran con su stock inicial; en los existentes se actualizan datos y precios y se conserva el stock real.

## Datos del catálogo

`data/Catalogo_500_Productos.xlsx` es el archivo original y `data/catalogo.json` es la versión que usa la carga inicial (`node scripts/excel-a-json.mjs` la regenera). El archivo trae 24 productos con estado *Inactivo* y 2 con precio $0 (SKU-00485 y SKU-00496). Estos se importan al ERP como inactivos y no se publican en la tienda hasta que se corrijan.
