---
name: nueva-feature
description: Flujo para agregar o modificar funcionalidad del POS sin romper la lógica existente ni duplicar código. Úsala SIEMPRE que el usuario pida agregar, crear, implementar, extender, integrar o modificar una feature, módulo, endpoint, pantalla, servicio o comportamiento del sistema, aunque no diga literalmente "feature". Úsala también ANTES de tocar órdenes, inventario, autenticación, plugins o el schema de Prisma.
---

# Nueva feature (POS Restaurante)

Objetivo: incorporar cambios manteniendo la arquitectura limpia, escalable y sin duplicación,
como lo haría un ingeniero senior. Sigue los pasos en orden; no te saltes la exploración.

## 1. Entiende antes de tocar
- Lee `CLAUDE.md`. Identifica la(s) capa(s) afectada(s): `fronted/`, `backend/`, base de datos.
- Localiza el módulo correcto y lee el código vecino para imitar sus patrones (CQRS,
  repositorios, tipos, naming).

## 2. Evita duplicar (DRY)
- Busca en el repo si ya existe una función/servicio/componente equivalente (grep por nombre y
  por dominio).
- Si hay algo parecido, reutilízalo o refactorízalo. No crees una segunda versión.
- Reporta brevemente qué encontraste y qué decidiste reutilizar.

## 3. Verifica impactos críticos
- **Multi-tenant:** toda consulta/mutación debe acotarse por `restauranteId` / `grupoNegocioId`.
  Nunca cruces datos entre tenants.
- **Órdenes:** si tocas órdenes, declara con cuál sistema trabajas (legacy `Orden` vs nuevo
  `OrdenSede`). No los mezcles sin aprobación explícita.
- **Zona peligrosa:** auth/RBAC, `PluginLoader`/feature flags y migraciones de Prisma requieren
  cuidado extra.

## 4. Planea (modo plan)
- Propón un plan: archivos a crear/editar por capa, tipos/DTOs, endpoints, cambios de schema y
  tests. **Espera aprobación antes de escribir código.**

## 5. Implementa por capas
- **Backend:** respeta Routes → Controller → Service → Repository → Prisma. Operaciones complejas
  vía Command/Query/EventBus; orquestación multi-agregado vía Saga. Controllers delgados.
- **Frontend:** estado global en Zustand, server state en React Query, llamadas vía Axios
  (respeta el interceptor JWT). Tiempo real con Socket.IO cuando aplique. UI con Tailwind + MUI,
  pensada para que sea intuitiva.
- Tipado estricto, sin `any`.

## 6. Si cambia el schema
- Edita `schema.prisma`, corre `npx prisma migrate dev` con un nombre descriptivo y
  `npx prisma generate`. Revisa el impacto de la migración sobre datos existentes.

## 7. Prueba
- Agrega/actualiza tests para el nuevo comportamiento.
- Corre `npm test` (los 45 existentes deben seguir pasando) y el build/typecheck.
- Usa `/code-review` sobre el diff para detectar duplicación o violaciones de capa.

## 8. Cierra
- Deja todo funcionando: nada a medias, sin código muerto ni TODOs silenciosos.
- Entrega un **resumen en lenguaje humano**: qué se agregó/cambió, en qué capas, qué decisiones
  se tomaron y cómo probarlo.
- Continúa con la skill `commit-push` para subir a GitHub.
