# MAPA-PROYECTO.md — POS Cocina Oculta

> Contexto rápido para Claude Code. No incluye valores de secretos ni credenciales.

---

## 1. Árbol de carpetas

```
pos-restaurante/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── application/        # CQRS: CommandBus, QueryBus, Sagas
│       │   ├── commands/       # (orden/, inventario/, producto/)
│       │   ├── queries/        # (orden/, dashboard/, reportes/, ...)
│       │   └── sagas/
│       ├── config/             # database, redis, socket.gateway, swagger, env
│       ├── controller/         # Un archivo por módulo, delgados
│       ├── core/events/        # EventBus singleton
│       ├── dto/                # Schemas Zod de entrada
│       ├── events/             # EventBus local + handlers (cache, socket, inventario)
│       ├── exceptions/         # AppError, HttpErrors, PrismaErrors
│       ├── jobs/               # inventario.job.ts (cron alertas)
│       ├── lib/                # pagination, decimal, response, tenantQuery
│       ├── middlewares/        # auth, permission, tenantContext/Isolation, audit, flagGate
│       ├── plugins/            # PluginLoader + core (usuarios, restaurantes, categorias)
│       ├── repositories/       # Un archivo por modelo; base/TenantRepository.ts
│       ├── routes/             # Un archivo por módulo + index.ts
│       ├── services/           # Lógica de negocio; __tests__/ con Vitest
│       └── server.ts
└── fronted/                    # (sic)
    └── src/
        ├── admin/              # LayoutAdmin + lazy pages (/admin/*)
        ├── components/         # auth/, common/, layout/, inventario/, ordenes/, reportes/
        ├── hooks/              # useSocket.ts
        ├── lib/                # socket.ts (singleton)
        ├── pages/              # Dashboard, Ordenes, Cocina, Clientes, Inventario, ...
        │   └── admin/          # Usuarios, Restaurantes, FeatureFlags, Plantillas, ...
        ├── services/           # Un servicio por módulo + api.ts (Axios singleton)
        ├── store/              # Zustand: useStore, restauranteStore, featureFlagStore, uiStore
        ├── types/
        └── utils/
```

---

## 2. Comandos por capa

### Backend (`cd backend`)
```bash
npm run dev            # tsx watch src/server.ts  → http://localhost:3000
npm run build          # tsc → dist/
npm test               # vitest run
npm run test:watch     # vitest (modo watch)
npm run test:coverage  # vitest run --coverage

npx prisma migrate dev   # aplica migraciones + regenera cliente
npx prisma generate      # solo regenera cliente (sin migración)
npx prisma studio        # GUI de la BD en el browser
npm run seed             # datos base
npm run seed:vylonia     # tenant demo "Vylonia"
npm run seed:recetas     # recetas de demo
```

### Frontend (`cd fronted`)
```bash
npm run dev     # vite → http://localhost:5173
npm run build   # tsc && vite build
npm test        # vitest run
```

---

## 3. Endpoints de la API

Base: `/api/v1/` (alias `/api/`). Todos requieren `Authorization: Bearer <token>` salvo los públicos.

### Auth  `/auth`
| Método | Ruta | Notas |
|--------|------|-------|
| POST | /auth/login | pública |
| POST | /auth/refresh | pública |
| GET  | /auth/profile | protegida |
| POST | /auth/logout | protegida |
| PUT  | /auth/change-password | protegida |

### Usuarios  `/usuarios` _(solo superadmin)_
| Método | Ruta |
|--------|------|
| GET    | /usuarios |
| GET    | /usuarios/roles |
| GET    | /usuarios/estadisticas |
| GET    | /usuarios/:id |
| POST   | /usuarios |
| PUT    | /usuarios/:id |
| PATCH  | /usuarios/:id/estado |
| PATCH  | /usuarios/:id/reset-password |
| PATCH  | /usuarios/:id/rol |
| GET    | /usuarios/:id/nomina |
| PUT    | /usuarios/:id/nomina |

### Productos  `/productos`
| Método | Ruta |
|--------|------|
| GET    | /productos |
| GET    | /productos/stock/bajo |
| GET    | /productos/sku/:sku |
| GET    | /productos/:id |
| POST   | /productos |
| PUT    | /productos/:id |
| PATCH  | /productos/:id |
| DELETE | /productos/:id |
| POST   | /productos/:id/stock |
| GET/POST/PUT/DELETE | /productos/:id/variantes |

### Categorías  `/categorias`
`GET / · GET /:id · POST / · PUT /:id · DELETE /:id · PATCH /reorder`

### Órdenes  `/ordenes`
| Método | Ruta | Arquitectura |
|--------|------|--------------|
| GET    | /ordenes | ambas |
| GET    | /ordenes/estadisticas | |
| GET    | /ordenes/:id | |
| POST   | /ordenes | nueva (body con `sedes[]`) o legado |
| PUT    | /ordenes/:id | legado |
| PATCH  | /ordenes/:id/estado | legado |
| DELETE | /ordenes/:id | legado (cancela vía CQRS) |
| POST   | /ordenes/:id/pagar | nueva |
| POST   | /ordenes/:id/cancelar | nueva |
| POST   | /ordenes/:id/detalles | legado |
| PUT    | /ordenes/:id/detalles/:detalleId | legado |
| DELETE | /ordenes/detalles/:detalleId | legado |

### OrdenSedes (cocina/KDS)  `/orden-sedes`
`GET / · GET /:id · PATCH /:id/avanzar · POST /:id/items · PUT /items/:itemId · DELETE /items/:itemId · POST /:id/cancelar`

### Clientes  `/clientes`
`GET / · GET /estadisticas · POST / · GET /:id · PUT /:id · PATCH /:id/estado · GET /:id/ordenes · GET|POST /:id/direcciones · PUT|DELETE /:id/direcciones/:id_dir · GET /:id/puntos · POST /:id/puntos/canjear`

### Inventario  `/inventario`
`GET /movimientos · POST /movimientos · GET /movimientos/stats · GET /lotes · GET /lotes/vencimiento · GET /valor`

### Proveedores  `/proveedores`
`GET / · GET /:id · POST / · PUT /:id · PATCH /:id/estado · GET|POST /:id/productos · PUT|DELETE /:id/productos/:productoId`

### Recetas  `/recetas`
`GET / · GET /:id · POST / · PUT /:id · PUT /:id/ingredientes · GET /:id/disponibilidad · GET|POST /:id/fases · PUT|DELETE /:id/fases/:id_fase · GET /producto/:id · POST /verificar-stock/:id_orden`

### Caja  `/caja`
`GET /turnos · GET /turnos/:id · POST /turnos · PUT /turnos/:id · DELETE /turnos/:id`
`GET /cierres · GET /cierres/:id · POST /cierres/iniciar · POST /cierres/:id/confirmar`

### Dashboard  `/dashboard`
`GET /stats · GET /ventas · GET /alertas`

### Reportes  `/reportes`
`GET /ventas · /productos · /categorias · /metodos-pago · /horas · /completo · /merma/valor · /tendencias/consumo · /clientes/top · /lotes/por-vencer`
`GET /consolidado/:id_grupo · /consolidado/:id_grupo/ventas|productos|pagos|clientes`
`GET /super-consolidado` _(solo superadmin)_

### Restaurantes  `/restaurantes`
`GET / · GET /default · GET /:id · POST / · PUT /:id · PATCH /:id/toggle · GET|POST /:id/usuarios · DELETE /:id/usuarios/:userId · GET /:id/config · PUT /:id/config/:clave · PATCH /:id/config · DELETE /:id/config/:clave`

### Otros módulos
| Prefijo | Operaciones |
|---------|-------------|
| `/grupos` | CRUD GrupoNegocio + usuarios del grupo |
| `/ordenes-grupo` | OrdenGrupo (legado multi-restaurante) |
| `/facturas` | GET / · GET /:id · POST / · PATCH /:id/anular |
| `/alertas` | GET / · PATCH /:id/leer · POST /leer-todas |
| `/tipos-alerta` | CRUD |
| `/metodos-pago` | CRUD |
| `/feature-flags` | GET / · POST / · PUT /:id · DELETE /:id · POST /:id/asignaciones |
| `/plantillas` | CRUD |
| `/ui-config` | GET / · PUT /:scope/:clave |
| `/configuracion` | GET / · PUT /:clave |
| `/auditoria` | GET / · GET /:id |
| `/estados-orden` | GET / · GET /:id + transiciones |
| `/listas-compras` | CRUD + ítems |
| `/recibos` | GET /:id (genera recibo de orden) |
| `/admin` | Rutas de administración interna (superadmin) |

---

## 4. Modelos Prisma

### Multi-tenant (tenant root → sedes → acceso)
```
GrupoNegocio              → Restaurante[] (id_grupo)
                          → UsuarioGrupo[] (rol en grupo: owner/admin/operador/auditor)
Restaurante               → UsuarioRestaurante[] (acceso por sede)
```
- `id_grupo` acota: Categoria, Producto, Proveedor, Cliente, PlantillaImpresion, Orden (nueva arq.)
- `id_restaurante` acota: Orden (legacy), OrdenSede, Lote, Movimiento, ProductoStock, CierreCaja, Alerta

### Catálogo compartido
| Modelo | Relaciones clave |
|--------|-----------------|
| Producto | → Categoria, GrupoNegocio, ProductoVariante[], ProductoStock[], RecetaIngrediente[], OrdenDetalle[], OrdenSedeItem[] |
| ProductoStock | Producto ×1 Restaurante (stock real por sede) |
| ProductoVariante | → Producto; referenciado en OrdenDetalle y OrdenSedeItem |
| Categoria | auto-referencia padre/hijos; → GrupoNegocio |
| Receta | → Producto (final), Restaurante; → RecetaIngrediente[], RecetaFase[] |

### Arquitectura dual de órdenes

**Legado**
```
Orden → OrdenDetalle (productos) → Pago (por método)
      → Factura
```

**Nueva (multi-restaurante)**
```
Orden (aggregate root, estado_global derivado por saga)
  └── OrdenSede[] (por restaurante, estado propio: PENDIENTE→EN_PREPARACION→LISTA→ENTREGADA)
        └── OrdenSedeItem[] (productos de esa sede)
  └── PagoOrden[] (pago global, multi-método)
  └── OrdenEvento[] (event log/audit trail)
```
> `estado_global` en Orden = BORRADOR | RECIBIDA | EN_PROCESO | LISTA | ENTREGADA | CANCELADA
> `estado` en OrdenSede = PENDIENTE | EN_PREPARACION | LISTA | ENTREGADA | CANCELADA

**OrdenGrupo** (legado multi-restaurante, antes de OrdenSede):
`OrdenGrupo → Orden[] → PagoGrupo[]`

### Operaciones
| Modelo | Relaciones clave |
|--------|-----------------|
| Cliente | → GrupoNegocio, Orden[], ClienteDireccion[], ClientePunto[] |
| Proveedor | → GrupoNegocio, ProveedorProducto[] |
| Lote | → Producto, Restaurante, Usuario (responsable) |
| Movimiento | → Producto, Restaurante |
| ListaCompras | → Restaurante, Proveedor, ListaComprasItem[] |
| CierreCaja | → Restaurante, Usuario, TurnoCaja |

### Configuración / Admin
| Modelo | Uso |
|--------|-----|
| Rol / Permiso / RolPermiso | RBAC; permisos como `recurso.accion` |
| FeatureFlag / FeatureFlagAsignacion | Feature flags con contexto |
| PlantillaImpresion | Plantillas JSON por grupo o sede |
| UiConfiguracion | Settings de UI por scope/clave |
| ConfiguracionRestaurante | Config KV por sede (IVA, moneda, etc.) |
| Configuracion | Config global del sistema |
| Auditoria | Log de operaciones críticas (BigInt id) |
| EstadoOrden / EstadoTransicion | FSM de estados de orden (legacy) |
| NominaEmpleado | Datos salariales del empleado |

---

## 5. Módulos principales del backend

| Módulo | Para qué sirve |
|--------|----------------|
| `auth` | Login, refresh token, perfil, cambio de contraseña |
| `usuarios` | CRUD de empleados + nómina (solo superadmin) |
| `restaurantes` | CRUD de sedes + asignación de usuarios + config KV |
| `grupos` | CRUD de GrupoNegocio (tenant raíz SaaS) |
| `productos` | Catálogo compartido + stock bajo + variantes |
| `categorias` | Árbol de categorías por grupo |
| `ordenes` | Ciclo de vida de órdenes (nueva arq. + legado) |
| `orden-sedes` | Vista de cocina/KDS: avanzar estado, gestionar ítems |
| `ordenes-grupo` | Órdenes multi-restaurante legado |
| `inventario` | Movimientos de stock + lotes + valor de inventario |
| `recetas` | Recetas de producción + ingredientes + fases + disponibilidad |
| `clientes` | CRUD de clientes + direcciones + programa de puntos |
| `proveedores` | CRUD de proveedores + catálogo de precios |
| `listas-compras` | Generación y seguimiento de órdenes de compra |
| `caja` | Turnos de caja + apertura/confirmación de cierres |
| `dashboard` | Stats rápidas + resumen de ventas + alertas de inventario |
| `reportes` | Reportes por sede y consolidados por grupo/superadmin |
| `facturas` | Emisión y anulación de facturas |
| `alertas` | Alertas de inventario (generadas por cron job cada hora) |
| `feature-flags` | Flags con scope global o por contexto |
| `plantillas` | Plantillas de impresión JSON (ticket, factura, comanda) |
| `ui-config` | Configuración de apariencia/UI por scope |
| `configuracion` | Parámetros globales del sistema |
| `auditoria` | Consulta del log de auditoría |
| `recibos` | Generación de recibo de una orden |
| `admin` | Operaciones internas de administración (superadmin) |
| `application/` | CommandBus, QueryBus, EventBus, Sagas (CQRS) |
| `plugins/` | PluginLoader con feature flags; ejemplo LoyaltyPlugin |
| `jobs/` | Cron de alertas de inventario (node-cron, America/Bogota) |
