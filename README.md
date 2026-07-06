# 🍽️ POS Cocina Oculta

Sistema de punto de venta (POS) completo para restaurantes y dark kitchens. Diseñado para operar en multi-sede bajo un único grupo de negocio, con cocina digital en tiempo real, gestión de inventario, fidelización de clientes y reportes de ventas.

---

## ¿Qué hace este sistema?

| Módulo | Descripción |
|---|---|
| **Órdenes** | Crea, gestiona y hace seguimiento de pedidos locales y a domicilio en tiempo real |
| **Cocina (KDS)** | Vista de cocina con actualizaciones por WebSocket — sin necesidad de refrescar la página |
| **Inventario** | Stock por sede con movimientos libres (entrada/salida/ajuste/merma), alertas de bajo inventario y lotes opcionales para productos almacenables (control de caducidad, reconteo y vida útil real vs. estimada) |
| **Recetas** | Construcción de recetas con ingredientes, fases, mermas y costos de producción |
| **Clientes** | Perfil de cliente, historial de órdenes y programa de puntos / fidelización |
| **Reportes** | Ventas por período, productos más vendidos, cierre de caja por turno |
| **Proveedores** | Catálogo de proveedores, precios y listas de compras automáticas |
| **Facturación** | Generación de facturas por orden, con soporte para multi-sede |
| **Multi-restaurante** | Una orden puede distribuirse a varias sedes simultáneamente |
| **Administración** | Usuarios, roles, permisos RBAC, auditoría completa, feature flags y configuración por sede |

---

## Stack Tecnológico

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express 4
- **Base de datos**: PostgreSQL vía Prisma 5 ORM
- **Caché**: Redis (opcional — el sistema funciona sin él)
- **Tiempo real**: Socket.IO (WebSocket)
- **Auth**: JWT (access token 15 min + refresh token 7 días)
- **Validación**: Zod
- **Docs API**: Swagger UI en `/api/docs`
- **Tests**: Vitest

### Frontend
- **Framework**: React 18 + Vite
- **UI**: MUI (Material UI) + TailwindCSS
- **Estado global**: Zustand (auth persistido en localStorage)
- **Datos del servidor**: TanStack React Query
- **Formularios**: React Hook Form + Zod
- **Gráficas**: Recharts
- **Tiempo real**: socket.io-client
- **Tests**: Vitest + Testing Library

---

## Arquitectura

```
GrupoNegocio (tenant SaaS)
├── Restaurante A
├── Restaurante B
└── Restaurante C
      ├── Usuarios, Stock, Lotes, Cierres de caja
      └── Órdenes → OrdenSede (por restaurante) → OrdenSedeItem
```

El catálogo (Productos, Categorías, Proveedores, Clientes) es **compartido** dentro del grupo. El stock, las órdenes y los movimientos son **independientes por sede**.

### Flujo de una orden

```
Cliente pide → Orden creada → OrdenSede por cada restaurante involucrado
                                    ↓
                          Cocina recibe en KDS (WebSocket)
                                    ↓
                    PENDIENTE → EN_PREPARACION → LISTA → ENTREGADA
                                    ↓
                         Orden global: LISTA → Cobro → ENTREGADA
```

---

## Requisitos previos

- Node.js 20+
- PostgreSQL 15+
- Redis (opcional)

---

## Instalación y puesta en marcha

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/pos-restaurante.git
cd pos-restaurante
```

### 2. Configurar el backend

```bash
cd backend
npm install
```

Crear el archivo `backend/.env`:

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/pos_restaurante
JWT_SECRET=tu_secreto_jwt_de_al_menos_32_caracteres
JWT_REFRESH_SECRET=otro_secreto_refresh_de_al_menos_32_caracteres
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Aplicar migraciones y poblar datos iniciales:

```bash
npx prisma migrate dev
npm run seed
```

Iniciar el servidor:

```bash
npm run dev   # http://localhost:3000
```

La documentación Swagger estará disponible en [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

### 3. Configurar el frontend

```bash
cd fronted
npm install
```

Crear el archivo `fronted/.env`:

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

Iniciar la app:

```bash
npm run dev   # http://localhost:5173
```

---

## Credenciales del seed (desarrollo)

Tras ejecutar `npm run seed`, el sistema crea un superadministrador por defecto:

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Contraseña | `Admin123!` |

> En producción, cambia estas credenciales inmediatamente.

---

## Comandos útiles

```bash
# Backend
npm run dev              # Servidor con hot reload
npm test                 # Ejecutar tests
npm run test:coverage    # Coverage de tests
npx prisma studio        # Interfaz visual de la base de datos

# Frontend
npm run dev              # App en modo desarrollo
npm run build            # Build de producción
npm test                 # Tests de componentes
```

---

## Estructura del proyecto

```
pos-restaurante/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos de datos
│   │   ├── migrations/         # Historial de migraciones
│   │   └── seed.ts             # Datos iniciales
│   └── src/
│       ├── application/        # CQRS: Commands, Queries, Sagas
│       ├── config/             # DB, Redis, Socket, Swagger, env
│       ├── controller/         # Capa HTTP (thin)
│       ├── dto/                # Schemas Zod de validación
│       ├── events/             # EventBus + handlers de dominio
│       ├── jobs/               # Cron jobs (alertas de inventario)
│       ├── middlewares/        # Auth, RBAC, Audit, Rate limit
│       ├── plugins/            # Módulos con feature flags
│       ├── repositories/       # Acceso a datos via Prisma
│       ├── routes/             # Definición de endpoints
│       └── services/           # Lógica de negocio
└── fronted/
    └── src/
        ├── components/         # Componentes reutilizables
        ├── hooks/              # Custom hooks (useSocket, etc.)
        ├── pages/              # Páginas por módulo
        ├── services/           # Clientes HTTP (Axios)
        └── store/              # Estado global (Zustand)
```

---

## API

Todos los endpoints siguen la convención:

```
/api/v1/{recurso}
```

Respuesta estándar:
```json
{ "success": true, "data": { ... } }
```

Respuesta paginada:
```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
```

El token JWT se envía en el header:
```
Authorization: Bearer <accessToken>
```

---

## Permisos (RBAC)

Los permisos siguen el patrón `recurso.accion`:

| Permiso | Descripción |
|---|---|
| `productos.ver` | Ver catálogo de productos |
| `productos.crear` | Crear productos |
| `productos.editar` | Editar productos |
| `productos.eliminar` | Eliminar productos |
| `ordenes.ver` | Ver órdenes |
| `ordenes.crear` | Crear órdenes |
| `ordenes.cancelar` | Cancelar órdenes |

Los permisos se asignan a roles. El **superadmin** tiene acceso total sin verificación de permisos.

---

## Tiempo real (WebSocket)

El backend emite eventos Socket.IO en los canales:

| Evento | Cuándo |
|---|---|
| `orden:nueva` | Se crea una nueva orden |
| `orden:actualizada` | Cambia el estado de una orden o sede |
| `alerta:inventario` | Stock de un producto baja del mínimo |

El frontend se conecta automáticamente con el hook `useSocket()`.

---

## Tests

```bash
# Correr todos los tests
cd backend && npm test

# Un archivo específico
npx vitest run src/services/__tests__/auth.service.test.ts
```

Cobertura actual: **420 tests** en 21 suites de servicios y utilidades (auth, inventario/lotes, órdenes, recetas, cierre de caja, onboarding, entre otros).

---

## Licencia

MIT
