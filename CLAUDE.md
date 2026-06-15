# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with two independent workspaces:
- `backend/` — Express + TypeScript + Prisma 5 + PostgreSQL + Socket.IO
- `fronted/` — React 18 + Vite + TypeScript + TailwindCSS + MUI (note: folder is spelled "fronted")

## Commands

### Backend (`cd backend`)
```bash
npm run dev          # Dev server with hot reload (tsx watch)
npm run build        # TypeScript compile → dist/
npm test             # Run all tests (Vitest)
npm run test:watch   # Watch mode
npm run test:coverage

# Prisma
npx prisma migrate dev   # Apply migrations + regenerate client
npx prisma generate      # Regenerate client after schema changes only
npx prisma studio        # GUI browser for DB
npm run seed             # Seed base data
npm run seed:vylonia     # Seed tenant "Vylonia"
npm run seed:recetas     # Seed recipes
```

### Frontend (`cd fronted`)
```bash
npm run dev     # Vite dev server (http://localhost:5173)
npm run build   # tsc + vite build
npm test        # Vitest
```

### Running a single test
```bash
# Backend — by file name pattern
npx vitest run src/services/__tests__/auth.service.test.ts

# Frontend
npx vitest run src/__tests__/ErrorBoundary.test.tsx
```

## Architecture

### Backend: Layered + CQRS

```
Routes → Controller → Service → Repository → Prisma
                ↕
          CommandBus / QueryBus / EventBus  (CQRS)
```

- **Routes** (`src/routes/index.ts`): All endpoints under `/api/v1/` (alias `/api/`). Each route file applies `authenticate` then `requirePermission('recurso.accion')`.
- **Controllers**: Thin — parse request, call service, return `{ success: true, data }`.
- **Services**: Business logic. Use `cacheGetOrSet(key, TTL, fn)` for reads; call `cacheDel(key)` on mutations. Call `registrarAuditoria()` after critical write operations.
- **Repositories**: Prisma queries. Always filter `estado: { not: EstadoGeneral.eliminado }` (soft-delete). Tenant repos extend `TenantRepository` (`src/repositories/base/TenantRepository.ts`).
- **CommandBus / QueryBus** (`src/application/`): CQRS pattern for complex operations (e.g., `CreateOrdenCommand`, `GetDashboardStatsQuery`).
- **EventBus** (`src/core/events/EventBus.ts`): Domain events. Handlers in `src/events/handlers/`.
- **Sagas** (`src/application/sagas/`): Multi-aggregate orchestration (e.g., OrdenSede state machine).
- **Plugins** (`src/plugins/`): Feature-flagged modules loaded at startup via `PluginLoader`. Core plugins: usuarios, restaurantes, categorias. Example: `LoyaltyPlugin`.

### Multi-tenant Model

```
GrupoNegocio (SaaS tenant root)
  └── Restaurante[] (sede/branch)
        └── UsuarioRestaurante (access control)
```

- `id_grupo` scopes shared data (Producto, Categoria, Cliente, Proveedor).
- `id_restaurante` scopes operational data (Orden, Lote, Movimiento, Stock, CierreCaja).
- `ProductoStock` separates per-restaurant stock from the shared product catalog.

### Orders: Dual Architecture

Legacy: `Orden → OrdenDetalle → Pago`  
New: `Orden (global) → OrdenSede (per-restaurant) → OrdenSedeItem → PagoOrden`

The `estado_global` on `Orden` is derived by the `OrdenSede` saga. `OrdenEvento` provides an audit/event log for each lifecycle transition.

### Frontend: State + Data Fetching

- **Zustand** (`src/store/`): Auth state persisted to `localStorage` key `auth-storage`. Access with `useAuthStore()`.
- **React Query** (`@tanstack/react-query`): Server state / API calls.
- **Axios** (`src/services/api.tsx`): Singleton with JWT auto-refresh and `failedQueue` for 401 handling.
- **Socket.IO** (`src/lib/socket.ts` + `src/hooks/useSocket.ts`): Real-time updates (kitchen display, order state changes).
- **Route guards**: `PrivateGuard` (auth), `AdminGuard` (superadmin only), `RequireRestaurante` (requires active restaurante context).
- **Admin pages** are `React.lazy()` loaded — only bundled when navigating to `/admin/*`.

### Auth Flow

1. `POST /api/v1/auth/login` → returns `accessToken` (15m) + `refreshToken` (7d).
2. Axios interceptor adds `Authorization: Bearer <token>` to every request.
3. On 401, interceptor calls `POST /api/v1/auth/refresh` and replays queued requests.
4. `es_super_admin` flag on `Usuario` is enforced via `req.esSuperAdmin` in middleware (not via the `Rol.es_super_admin` field).

### Environment Variables

**Backend** (`.env`):
```
DATABASE_URL=postgresql://...
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>
REDIS_URL=redis://localhost:6379   # optional — system works without Redis
CORS_ORIGIN=http://localhost:5173
SUPER_ADMIN_UUID=<uuid matching seed>
```

**Frontend** (`.env`):
```
VITE_API_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

## Key Patterns

- **API response shape**: `{ success: true, data, message? }` or paginated `{ success: true, data, meta: { total, page, limit, totalPages } }`.
- **Soft delete**: Never hard-delete records. Set `estado = 'eliminado'`. All repo queries filter it out.
- **RBAC**: Permissions seeded as `recurso.accion` codes (e.g., `productos.ver`, `ordenes.cancelar`). `requirePermission('codigo')` middleware does a DB lookup per request.
- **Redis cache**: `cacheGetOrSet(key, TTL_seconds, asyncFn)` in `src/config/redis.ts`. Returns fresh data if Redis is down (fail-open).
- **Feature flags**: `FeatureFlag` model + `flagGate` middleware. Frontend: `useFeatureFlag()` hook + `featureFlagStore`.
- **Swagger docs**: Available at `http://localhost:3000/api/docs` in development only.
- **BigInt serialization**: `BigInt.prototype.toJSON` is patched in `server.ts` to serialize as string (needed for `Auditoria.id`).
