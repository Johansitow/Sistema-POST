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
| Solo delivery | `ordenes.modelo_servicio=delivery` · `modulo.mesas=off` · `ordenes.propina=off` |
| Solo mostrador | `ordenes.modelo_servicio=mostrador` · `modulo.mesas=off` · `ordenes.propina=off` |
| Mesas / salón *(módulo parcial)* | `ordenes.modelo_servicio=mesas` · `modulo.mesas=on` · `ordenes.propina=on` |
| Mixto *(módulo parcial)* | `ordenes.modelo_servicio=mixto` · `modulo.mesas=on` · `ordenes.propina=on` |

> **Delivery y clientes:** delivery NO fuerza `modulo.clientes=on`. El modelo `Orden`
> tiene campos propios para la entrega (`direccion_entrega`, `telefono_contacto`,
> `nombre_contacto`, `notas_entrega`) con `id_cliente Int?` opcional — exactamente
> como `mesa` vive en la orden sin módulo de salón detrás. Una dark kitchen puede
> operar delivery sin base de clientes. **El Eje 6 es el único dueño de `modulo.clientes`.**

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

#### Sub-eje 4B — Impuesto `(S, adaptativo)` — *pregunta condicional*
> "¿Operas bajo contrato de franquicia, concesión o regalía?"

| Respuesta | Escribe |
|---|---|
| No (default) | `facturacion.impuesto_tipo=impoconsumo` · `facturacion.impuesto_tarifa=8` |
| Sí | `facturacion.impuesto_tipo=iva` · `facturacion.impuesto_tarifa=19` |

> **Por qué dos claves en lugar de `facturacion.iva`:** el sistema necesita saber *qué*
> impuesto cobra, no solo el porcentaje. El ticket impreso debe discriminar "INC 8%"
> de "IVA 19%" (obligación legal en Colombia). Con una sola clave numérica no sería
> posible.
>
> **Contexto fiscal (referencia, no asesoría):** en Colombia los restaurantes están
> excluidos de IVA y gravados con impoconsumo 8% (ET art. 512-1 / 512-9). Las
> franquicias, concesiones y negocios bajo regalía sí causan IVA 19%. El usuario
> confirmará el régimen con su contador; el wizard solo fija el default del sistema.
>
> **Carácter opcional:** si el usuario no responde este sub-eje, el resolver **no
> emite nada** — las claves caen al default global sembrado en el seed
> (`impoconsumo / 8`) por la resolución sede→grupo→global. La tarifa es editable
> posteriormente (un restaurante no responsable del INC puede pasarla a exento).
>
> **Dueño único:** este sub-eje es el único que escribe `facturacion.impuesto_tipo`
> y `facturacion.impuesto_tarifa`. Ningún otro eje debe tocar estas claves.

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

> **Eje 6 es el único dueño de `modulo.clientes` y `modulo.fidelizacion`.**
> Ningún otro eje escribe estas claves. El resolver debe fallar fuerte si detecta
> que dos ejes distintos escriben valores distintos a la misma clave sin una regla
> explícita en este catálogo — no resolver colisiones por orden de iteración.

### Eje 7 — Estructura multi-sede `(G)`
> "¿Es una sola sede o un grupo con varias?"

| Opción | Escribe |
|---|---|
| Una sola sede | `estructura.multisede=off` · `modulo.reportes_consolidados=off` |
| Grupo con varias sedes | `estructura.multisede=on` · `modulo.reportes_consolidados=on` |

> Recordatorio: este eje **no** toca la arquitectura de órdenes. `OrdenSede` siempre activa.

---

## 5. Dependencias entre flags (fuente de verdad)

Un flag/capacidad puede depender de que otro módulo esté activo. Si el módulo-padre se
apaga, el dependiente queda "huérfano" — activo pero sin función real. La lógica de
`detectarHuerfanos` usa esta tabla como única fuente; no infiere dependencias del código.

| Dependiente (hijo) | Requiere (padre) | Motivo | Estado |
|---|---|---|---|
| `modulo.fidelizacion` | `modulo.clientes` | La fidelización por puntos necesita una base de clientes; sin ella `LoyaltyPlugin` no tiene a quién asignar puntos. | ✅ confirmada |
| `inventario.lotes` | `modulo.inventario` | El control de lotes/vencimiento requiere que el módulo de inventario esté activo; sin él no hay movimientos ni stock. | ✅ confirmada |
| `inventario.descuento_auto` | `modulo.inventario` | El descuento automático por exceso de stock necesita el módulo de inventario para leer los niveles actuales. | ✅ confirmada |
| `recetas.fases` | `modulo.recetas` | Las fases (KDS por estaciones) son una capacidad del módulo de recetas; sin ese módulo no hay receta que dividir en fases. | ✅ confirmada |
| `modulo.reportes_consolidados` | `estructura.multisede` | Los reportes consolidados agregan datos de múltiples sedes; con una sola sede no hay nada que consolidar. | ✅ confirmada |
| `ordenes.propina` | `modulo.mesas` | La propina está diseñada para atención en mesa (Eje 1); en delivery/mostrador el campo no aplica. Ambos flags son escritos juntos por el mismo eje, pero la dependencia es real. | ✅ confirmada |

### Candidatas evaluadas y descartadas

| Par evaluado | Decisión |
|---|---|
| `ordenes.modelo_servicio` → `modulo.mesas` | No es una dependencia; es un valor KV de configuración, no un flag booleano que pueda quedar "activo sin padre". |
| `modulo.facturas` → cualquier otro módulo | Sin dependencia en el catálogo actual; funciona de forma independiente (Eje 4). |
| `modulo.caja` → cualquier otro módulo | Sin dependencia declarada; es un módulo autónomo (Eje 5). |

### Separación de conceptos

- **Colisión** (`mergeConColisionGuard`): dos ejes distintos escriben valores DISTINTOS a la
  misma clave. Error de configuración del catálogo. Se lanza antes de persistir.
- **Dependencia huérfana** (`detectarHuerfanos`): un flag que está o quedaría activo, pero su
  módulo-padre quedó apagado por el nuevo perfil. No es un error del catálogo; es una
  consecuencia derivada que debe comunicarse al usuario y, en apply, corregirse.

---

## 6. Ejes destacados vs ajustes finos

Para que el onboarding no se sienta un interrogatorio, el wizard destaca los ejes que
más cambian la cara de la app (**1, 2, 4**) y deriva el resto del arquetipo elegido,
dejándolos como "ajustes finos" opcionales.

---

## 7. Arquetipos (presets de ejes)

Cada arquetipo es una fila de respuestas predefinidas. El usuario elige uno y puede
ajustar cualquier eje después.

| Arquetipo | Servicio | Inventario | Recetas | Facturación | Caja | Clientes | Multi-sede | Franquicia |
|---|---|---|---|---|---|---|---|---|
| Dark kitchen | delivery | simple | simples | ticket | no | registro | no | no |
| Con mesas | mesas *(parcial)* | avanzado | fases | ambos | sí | registro | no | no |
| Comida rápida | mostrador | simple | simples | ticket | sí | anónimo | no | no |
| Cafetería / panadería | mostrador | simple | no usa | ticket | sí | anónimo | no | no |
| Bar | mixto *(parcial)* | avanzado | simples | ambos | sí | anónimo | no | no |
| Franquicia | mixto *(parcial)* | avanzado | fases | ambos | sí | puntos | sí | **sí** |

---

## 8. Lo que falta para el wizard (mapa de entregables)

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

## 9. Pendientes antes de cerrar

- [x] Confirmar si `ConfiguracionRestaurante` admite scope de grupo → resuelto: se creó
  `ConfiguracionGrupo` como espejo con `id_grupo`. Las tres capas están alineadas.
- [x] Conflicto `modulo.clientes` entre Eje 1 y Eje 6 → resuelto: `id_cliente` es
  opcional en `Orden`; `direccion_entrega` vive directo en la orden. Eje 6 es el único
  dueño. Delivery+anónimo es una combinación válida (dark kitchen sin base de clientes).
- [x] Definir defaults de impuesto por país/arquetipo → resuelto: `facturacion.iva`
  reemplazada por `facturacion.impuesto_tipo` (impoconsumo|iva) y
  `facturacion.impuesto_tarifa` (8|19). Default global: impoconsumo 8%. Franquicias:
  iva 19%. El sub-eje 4B es opcional; si no se responde cae al seed global.
- [ ] Confirmar nombres finales de claves al sembrar el seed.

---

## 10. Qué se documentará en Confluence al cerrar la feature

La versión depurada: la decisión grupo/sede, el contrato de los endpoints
preview/apply, y el catálogo final de ejes (como conocimiento de negocio durable).
