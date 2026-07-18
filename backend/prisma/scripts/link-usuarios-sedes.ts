/**
 * link-usuarios-sedes.ts — script one-off idempotente.
 *
 * Enlaza todos los usuarios activos del sistema a TODAS las sedes activas
 * del grupo indicado (UsuarioRestaurante) y al grupo (UsuarioGrupo).
 *
 * Uso:
 *   npx tsx prisma/scripts/link-usuarios-sedes.ts --dry   # solo muestra qué haría
 *   npx tsx prisma/scripts/link-usuarios-sedes.ts         # aplica los cambios
 *   npx tsx prisma/scripts/link-usuarios-sedes.ts --grupo "Otro Grupo"
 *
 * Nota: la lista de sedes viaja en el JWT — los usuarios deben volver a
 * iniciar sesión para ver las sedes recién asignadas.
 */

import { PrismaClient, RolGrupo } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry');
const grupoArgIdx = process.argv.indexOf('--grupo');
const GRUPO_NOMBRE = grupoArgIdx !== -1 ? process.argv[grupoArgIdx + 1] : 'Vylonia';

async function main(): Promise<void> {
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Enlazando usuarios al grupo "${GRUPO_NOMBRE}"...\n`);

  const grupo = await prisma.grupoNegocio.findFirst({
    where: { nombre: GRUPO_NOMBRE },
    include: {
      restaurantes: { where: { activo: true }, select: { id: true, nombre: true } },
    },
  });

  if (!grupo) {
    const grupos = await prisma.grupoNegocio.findMany({ select: { id: true, nombre: true } });
    console.error(`❌ No existe el grupo "${GRUPO_NOMBRE}". Grupos disponibles:`);
    for (const g of grupos) console.error(`   - [${g.id}] ${g.nombre}`);
    process.exit(1);
  }

  if (grupo.restaurantes.length === 0) {
    console.error(`❌ El grupo "${grupo.nombre}" no tiene restaurantes activos.`);
    process.exit(1);
  }

  console.log(`Grupo: [${grupo.id}] ${grupo.nombre}`);
  console.log(`Sedes activas: ${grupo.restaurantes.map(r => `[${r.id}] ${r.nombre}`).join(', ')}\n`);

  const usuarios = await prisma.usuario.findMany({
    where: { estado: 'activo' },
    select: {
      id: true,
      usuario: true,
      nombre_completo: true,
      es_super_admin: true,
      restaurantes: { select: { id_restaurante: true, es_activo: true } },
      grupos: { select: { id_grupo: true, es_activo: true } },
    },
  });

  let sedesCreadas = 0;
  let sedesReactivadas = 0;
  let gruposCreados = 0;

  for (const u of usuarios) {
    console.log(`Usuario [${u.id}] ${u.usuario} (${u.nombre_completo})${u.es_super_admin ? ' — superadmin' : ''}`);

    for (const sede of grupo.restaurantes) {
      const existente = u.restaurantes.find(r => r.id_restaurante === sede.id);
      if (existente?.es_activo) {
        console.log(`  = ya enlazado a "${sede.nombre}"`);
        continue;
      }
      const accion = existente ? 'reactivar' : 'crear';
      console.log(`  + ${accion} enlace con "${sede.nombre}"`);
      if (!DRY_RUN) {
        await prisma.usuarioRestaurante.upsert({
          where: { id_usuario_id_restaurante: { id_usuario: u.id, id_restaurante: sede.id } },
          create: { id_usuario: u.id, id_restaurante: sede.id, es_activo: true },
          update: { es_activo: true },
        });
      }
      if (existente) sedesReactivadas++; else sedesCreadas++;
    }

    const grupoExistente = u.grupos.find(g => g.id_grupo === grupo.id);
    if (grupoExistente?.es_activo) {
      console.log('  = ya pertenece al grupo');
    } else {
      const rol: RolGrupo = u.es_super_admin ? RolGrupo.owner : RolGrupo.operador;
      console.log(`  + ${grupoExistente ? 'reactivar' : 'crear'} membresía de grupo (rol: ${rol})`);
      if (!DRY_RUN) {
        await prisma.usuarioGrupo.upsert({
          where: { id_usuario_id_grupo: { id_usuario: u.id, id_grupo: grupo.id } },
          create: { id_usuario: u.id, id_grupo: grupo.id, rol_en_grupo: rol, es_activo: true },
          update: { es_activo: true },
        });
      }
      gruposCreados++;
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] Se harían' : 'Hechos'}: ${sedesCreadas} enlaces de sede nuevos, ${sedesReactivadas} reactivados, ${gruposCreados} membresías de grupo.`);
  if (!DRY_RUN && (sedesCreadas > 0 || sedesReactivadas > 0)) {
    console.log('⚠️  Los usuarios deben volver a iniciar sesión para ver las nuevas sedes (la lista viaja en el JWT).');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
