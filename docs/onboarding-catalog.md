# Catálogo de onboarding — POS Cocina Oculta

> Base del **Entregable 1** del wizard de configuración adaptativa.
> Define los *ejes* de configuración, sus opciones, y qué escribe cada una.
> De este archivo salen: (1) el seed de claves KV en Prisma y (2) la lógica de
> arquetipos del endpoint `POST /api/v1/onboarding/apply`.
>
> Estado: **borrador para revisión**. No es código; es la fuente de verdad de negocio.

---

## 0. Principios de este catálogo

- El wizard **no es** el motor de personalización. Es la entrada amigable a un motor
  que ya existe: feature flags + config KV + UI config.
- Los **arquetipos** son atajos: presets de respuestas de ejes. La verdad son los ejes.
- Cada opción de cada eje se traduce en escrituras concretas y deterministas. La misma
  función pura debe servir para *previsualizar* (sin escribir) y para *aplicar*.

---

## 1. Nivel de configuración: grupo vs sede

Regla **mixta**, derivada de cómo el schema acota cada modelo:

- **Ejes de grupo `(G)`** — se deciden una vez y valen para todas las sedes del grupo:
  catálogo, clientes/fidelización, recetas (definición), estructura multi-sede.
- **Ejes de sede `(S)`** — cada sede los ajusta: modelo de servicio, inventario,
  facturación, caja, moneda.

Flujo:
- **Primera sede de un grupo nuevo** → wizard completo (ejes `G` + ejes `S`).
- **Sedes siguientes del mismo grupo** → wizard corto (los `G` ya están resueltos; solo pregunta `S`).

> ⚠️ **Pendiente de confirmar contra el código:** si `ConfiguracionRestaurante` puede
> guardar config a nivel grupo o si para los ejes `(G)` se usa otra tabla/scope.

---

## 2. Convención de nombres

| Espacio | Forma | Para qué | Ejemplo |
|---|---|---|---|
| Feature flags | `modulo.<nombre>` / `<modulo>.<capacidad>` | prender/apagar módulos o capacidades (booleano) | `modulo.inventario`, `inventario.lotes` |
| Config KV (`ConfiguracionRestaurante`) | `<area>.<clave>` | valores con contenido | `facturacion.tipo`, `general.moneda` |
| UI config (`UiConfiguracion`) | `<scope>/<clave>` | apariencia por scope | `dashboard/layout` |

> Convención a validar contra el código real al sembrar el seed.

---

## 3. Decisión clave heredada de la investigación de código

**La arquitectura `OrdenSede` SIEMPRE está activa, para todos los restaurantes.**

`OrdenSede` está diseñado como "una sede = un restaurante" y sirve igual como KDS de una
sola sede (siempre hay exactamente un `OrdenSede` por `Orden`; la saga
`OrdenDeliveryReadinessSaga` dispara de inmediato). Por tanto:

- El wizard **nunca** expone ni menciona el camino legacy `Orden/OrdenDetalle`.
- El Eje 7 **no** decide arquitectura de órdenes; solo controla reportes consolidados y
  la UI de gestión de sedes.

---

## 4. Ejes de configuración

### Eje 1 — Modelo de servicio `(S)` — *la pregunta madre*
> "¿Cómo recibe y entrega los pedidos su restaurante?"

| Opción | Escribe |
|---|---|
| Solo delivery | `ordenes.modelo_servicio=delivery` · `modulo.mesas=off` · `ordenes.propina=off` · `modulo.clientes=on` |
| Solo mostrador | `ordenes.modelo_servicio=mostrador` · `modulo.mesas=off` · `ordenes.propina=off` |
| Mesas / salón *(módulo parcial)* | `ordenes.modelo_servicio=mesas` · `modulo.mesas=on` · `ordenes.propina=on` |
| Mixto *(módulo parcial)* | `ordenes.modelo_servicio=mixto` · `modulo.mesas=on` · `ordenes.propina=on` |

> ⚠️ **`modulo.mesas` es parcial:** hoy solo existe el campo `mesa` en la orden
> (`CreateOrdenCommand`), **no** un gestor de salón (sin plano, sin estado de mesa, sin
> asignación de mesero). El wizard puede preguntar y activar el flag, pero el frontend
> debe mostrar **solo el campo `mesa`**, no prometer un gestor completo.

### Eje 2 — Inventario `(S)`
> "¿Cómo controla el inventario?"

| Opción | Escribe |
|---|---|
| No lo controlo | `modulo.inventario=off` · `inventario.descuento_auto=off` |
| Simple (stock por unidad) | `modulo.inventario=on` · `inventario.lotes=off` · `inventario.descuento_auto=on` |
| Avanzado (lotes + vencimiento) | `modulo.inventario=on` · `inventario.lotes=on` · `inventario.descuento_auto=on` · activa cron de alertas |

### Eje 3 — Recetas / producción `(G define, S usa)`
> "¿Usa recetas para producir sus platos?"

| Opción | Escribe |
|---|---|
| No uso recetas | `modulo.recetas=off` |
| Recetas simples | `modulo.recetas=on` · `recetas.fases=off` |
| Recetas con fases (KDS por estaciones) | `modulo.recetas=on` · `recetas.fases=on` |

### Eje 4 — Facturación `(S, defaults de G)`
> "¿Qué documento entrega al cobrar?" + "¿En qué moneda?"

| Opción | Escribe |
|---|---|
| Solo ticket simple | `facturacion.tipo=ticket` · plantilla de ticket por defecto |
| Factura formal | `facturacion.tipo=formal` · `modulo.facturas=on` |
| Ambos | `facturacion.tipo=ambos` · `modulo.facturas=on` |
| **Moneda** (sí se pregunta) | `general.moneda=<COP/USD/…>` (default por país, confirmado con un tap) |
| **IVA** (NO se pregunta) | `facturacion.iva=<default del país/arquetipo>` — ajuste fino va a configuración posterior |

> Decisión: la **moneda** es fundacional → se pregunta en el wizard. El **IVA** tiene
> matices (tasas múltiples, exenciones) que un onboarding no debe simplificar mal → se
> siembra un default y se refina luego en el módulo de configuración.

### Eje 5 — Caja `(S)`
> "¿Maneja turnos y cierres de caja?"

| Opción | Escribe |
|---|---|
| Sin control de caja | `modulo.caja=off` |
| Turnos + cierres | `modulo.caja=on` |

### Eje 6 — Clientes y fidelización `(G)`
> "¿Registra a sus clientes?"

| Opción | Escribe |
|---|---|
| Ventas anónimas | `modulo.clientes=off` · `modulo.fidelizacion=off` |
| Registro de clientes | `modulo.clientes=on` · `modulo.fidelizacion=off` |
| Clientes + puntos | `modulo.clientes=on` · `modulo.fidelizacion=on` (activa `LoyaltyPlugin`) |

### Eje 7 — Estructura multi-sede `(G)`
> "¿Es una sola sede o un grupo con varias?"

| Opción | Escribe |
|---|---|
| Una sola sede | `estructura.multisede=off` · `modulo.reportes_consolidados=off` |
| Grupo con varias sedes | `estructura.multisede=on` · `modulo.reportes_consolidados=on` |

> Recordatorio: este eje **no** toca la arquitectura de órdenes. `OrdenSede` siempre activa.

---

## 5. Ejes destacados vs ajustes finos

Para que el onboarding no se sienta un interrogatorio, el wizard destaca los ejes que
más cambian la cara de la app (**1, 2, 4**) y deriva el resto del arquetipo elegido,
dejándolos como "ajustes finos" opcionales.

---

## 6. Arquetipos (presets de ejes)

Cada arquetipo es una fila de respuestas predefinidas. El usuario elige uno y puede
ajustar cualquier eje después.

| Arquetipo | Servicio | Inventario | Recetas | Facturación | Caja | Clientes | Multi-sede |
|---|---|---|---|---|---|---|---|
| Dark kitchen | delivery | simple | simples | ticket | no | registro | no |
| Con mesas | mesas *(parcial)* | avanzado | fases | ambos | sí | registro | no |
| Comida rápida | mostrador | simple | simples | ticket | sí | anónimo | no |
| Cafetería / panadería | mostrador | simple | no usa | ticket | sí | anónimo | no |
| Bar | mixto *(parcial)* | avanzado | simples | ambos | sí | anónimo | no |
| Franquicia | mixto *(parcial)* | avanzado | fases | ambos | sí | puntos | sí |

---

## 7. Lo que falta para el wizard (mapa de entregables)

| Pieza | Estado | Entregable |
|---|---|---|
| Catálogo de ejes y arquetipos (este archivo) | en revisión | 1 |
| Seed de claves KV en Prisma (`general.moneda`, `ordenes.modelo_servicio`, etc.) | no existe | 1→2 |
| Lógica de arquetipos en backend (preset → flags + configs) | no existe | 2 |
| `POST /api/v1/onboarding/apply` (preview + apply, transaccional) | no existe | 2 |
| Guard de "onboarding pendiente" (flag `onboarding_completado`) | no existe | 2/3 |
| Pantalla del wizard + modo prueba (relanzable) | no existe | 3 |

### Infraestructura que ya existe y se reutiliza
- Feature flags: CRUD + `GET /feature-flags/client` (mapa `{nombre:boolean}`) + evento
  `FEATURE_FLAG_CHANGED` por WebSocket.
- Config KV: CRUD + `PATCH /` con array `{clave,valor}` (escritura múltiple, ideal para el apply).
- Frontend: `featureFlagStore` (`loadFlags`/`reloadFlags`), `useFeatureFlag()`, `FlagRoute`.

### Razón del endpoint propio
1. **Atomicidad:** flags y config KV son dos tablas. El apply debe ser transaccional
   (todo o nada) para no dejar sedes a medio configurar.
2. **Fuente única:** la equivalencia "arquetipo → flags+configs" vive en el backend,
   no duplicada en el frontend.

---

## 8. Pendientes antes de cerrar

- [ ] Confirmar si `ConfiguracionRestaurante` admite scope de grupo (ejes `(G)`).
- [ ] Definir defaults de `facturacion.iva` y `general.moneda` por país/arquetipo.
- [ ] Confirmar nombres finales de claves al sembrar el seed.

---

## 9. Qué se documentará en Confluence al cerrar la feature

La versión depurada: la decisión grupo/sede, el contrato de los endpoints
preview/apply, y el catálogo final de ejes (como conocimiento de negocio durable).
