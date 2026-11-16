<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Integración con el ERP (leer antes de tocar código)

Lee `README.md` completo; la sección 4 es el contrato con el ERP/OMS (Marzza01/ERP-Log-stica-). Reglas:

- El SKU es la llave entre sistemas. `products.erp_id` guarda el GUID del ERP y es obligatorio para comprar en el ERP.
- La tienda nunca escribe en la base del ERP; solo usa su API HTTP (`src/lib/erp.ts`). Tienda y ERP tienen bases separadas.
- Una compra nunca debe fallar por culpa del ERP: se crea en la tienda y se envía después con `after()`; los fallos quedan en `orders.erp_error` y se reenvían desde `/admin/erp` con la misma `Idempotency-Key` (`LOGIMKT-<código>`).
- Volver a importar el catálogo no debe sobrescribir el stock de SKUs existentes.
- Sin variables `ERP_*`, todo debe seguir funcionando con el OMS interno.
- Nunca subas `.env*` ni escribas contraseñas en el código, logs o documentación.
