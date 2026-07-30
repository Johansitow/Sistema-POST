# Migraciones Prisma — reglas del proyecto

## Regla de oro: NUNCA `prisma db push`

`prisma db push` sincroniza el schema contra la base **sin crear una migración
versionada**. En este proyecto está **prohibido** porque:

- No deja rastro reversible del cambio (no hay archivo de migración).
- Provoca deriva (drift) entre lo que dice el schema y lo que hay en la base,
  y esa deriva ya causó problemas antes (ver historial de migraciones reparado
  con baselines idempotentes).

Por eso el script `prisma:push` fue **eliminado** de `package.json`.

## Desarrollo: crear una migración

Cuando cambies `schema.prisma`, crea una migración versionada con nombre descriptivo:

```bash
npm run prisma:migrate -- --name descripcion_del_cambio   # = prisma migrate dev
npm run prisma:generate                                    # regenerar el client
```

> Detén el `dev` server antes de `prisma generate` (Windows bloquea el archivo del client).

Si `migrate dev` falla por la deriva histórica de esta base, usa el flujo alterno
(`prisma migrate diff` + shadow DB) para generar el SQL y colócalo como una nueva
migración manual. Confirma siempre la carpeta `prisma/migrations/` en git.

## Producción: aplicar migraciones

En producción **nunca** se usa `migrate dev` (crea/edita migraciones) ni `db push`.
Solo se **aplican** las migraciones ya versionadas y commiteadas:

```bash
npm run prisma:deploy   # = prisma migrate deploy
```

`prisma migrate deploy` aplica, en orden, las migraciones pendientes de
`prisma/migrations/` y no genera cambios nuevos. Es idempotente y seguro para CI/CD.

### Orden recomendado en un despliegue

1. `npm run build` (compila el backend).
2. `npm run prisma:deploy` (aplica migraciones pendientes).
3. `npm start` (arranca el servidor ya con la base al día).

> Haz un **backup de la base antes de aplicar migraciones** en producción
> (ver `backend/scripts/README.md`).
