---
name: commit-push
description: Flujo para guardar el trabajo en GitHub con commits claros y un resumen entendible para el usuario. Úsala SIEMPRE que el usuario pida hacer commit, push, guardar, subir, versionar, "súbelo a GitHub" o cerrar un cambio, aunque no use esas palabras exactas. Úsala al final de cada feature, después de la skill nueva-feature.
---

# Commit & Push (POS Restaurante)

Objetivo: versionar de forma limpia y dejarle al usuario un resumen que entienda sin leer el diff.

## Antes de commitear
1. Revisa el estado: `git status` y `git diff`. Confirma que NO se cuelan archivos no deseados
   (`.env`, secretos, `node_modules`, artefactos de build). Si alguno aparece, agrégalo a
   `.gitignore` antes de continuar.
2. Verifica que el trabajo está terminado: `npm test` en verde y build OK. Si algo falla, **no
   hagas commit**: arréglalo o repórtalo al usuario.

## Commit
- Usa **Conventional Commits**: `tipo(alcance): descripción breve`.
  - Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
  - Ejemplos:
    - `feat(ordenes): agregar división de cuenta en OrdenSede`
    - `fix(inventario): corregir alerta de stock por restaurante`
    - `refactor(auth): extraer verificación de permisos a un guard`
- Si el cambio es grande, divídelo en **commits lógicos** en vez de uno gigante.
- Cuerpo del commit (opcional): el porqué del cambio y notas relevantes.

## Push
- Confirma la rama: `git branch --show-current`. Si el usuario usa ramas de feature, trabaja en
  una; si no, sigue su convención.
- `git push` (o `git push -u origin <rama>` si la rama es nueva).
- **Credenciales:** si falta permiso o autenticación, NO inventes ni pidas tokens en texto plano.
  Avisa al usuario para que autentique GitHub en su máquina (p. ej. `gh auth login`) y reintenta.

## Resumen para el usuario (obligatorio)
Termina con un resumen breve y claro:
- **Qué se hizo** (1–3 frases).
- **Áreas/archivos tocados** y por qué.
- **Cómo probarlo.**
- **Commit(s) y rama.**

Este mismo resumen es lo que se llevará a la biblioteca de Confluence.
