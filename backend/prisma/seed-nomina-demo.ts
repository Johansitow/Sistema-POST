/**
 * seed-nomina-demo.ts — datos de prueba para recorrer el módulo de RRHH.
 *
 *   npm run seed:nomina-demo            crea los datos
 *   npm run seed:nomina-demo -- --limpiar   los borra
 *
 * Crea tres empleados con perfiles DISTINTOS a propósito, para que el semáforo
 * de la prenómina muestre sus tres estados:
 *
 *   Ana Restrepo    ficha completa                  → verde
 *   Bruno Salazar   sin cuenta bancaria             → advertencia
 *   Carla Ospina    salario por debajo del mínimo   → bloqueante
 *
 * Y un aprobador aparte, porque la nómina exige que quien aprueba no sea quien
 * liquidó: sin un segundo administrador no se puede recorrer el ciclo completo.
 *
 * El periodo se crea en MARZO DE 2025 a propósito: los parámetros legales de
 * 2025 están verificados, así que se puede liquidar de inmediato. Los de 2026
 * siguen sin verificar hasta que se carguen las cifras oficiales.
 *
 * Todo lo que crea este script lleva el marcador `@demo.local` en el email y
 * el prefijo `DEMO —` en el periodo, así que la limpieza es exacta y NO toca
 * los usuarios reales (Carlos Cajero, María Cocina, el administrador).
 */

import { PrismaClient, RolGrupo } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const MARCADOR_EMAIL = '@demo.local';
const PREFIJO_PERIODO = 'DEMO —';

/** Contraseña de los usuarios de demostración. Solo para el entorno local. */
const PASSWORD_DEMO = 'Demo1234!';

const EMPLEADOS = [
  {
    nombre_completo: 'Ana Restrepo Vélez',
    usuario: 'demo.ana',
    cargo: 'Chef Principal',
    documento_identidad: '1020304050',
    fecha_ingreso: new Date(Date.UTC(2023, 5, 15)),
    salario: 2_400_000,
    banco: 'Bancolombia', tipo_cuenta: 'ahorros', numero_cuenta: '91234567890',
    nivel_riesgo_arl: 'II',
    completo: true,
  },
  {
    nombre_completo: 'Bruno Salazar Mejía',
    usuario: 'demo.bruno',
    cargo: 'Mesero',
    documento_identidad: '1098765432',
    fecha_ingreso: new Date(Date.UTC(2024, 10, 1)),
    salario: 1_423_500,          // salario mínimo exacto → lleva auxilio de transporte
    banco: null, tipo_cuenta: null, numero_cuenta: null,   // ← dispara la ADVERTENCIA
    nivel_riesgo_arl: 'II',
    completo: true,
  },
  {
    nombre_completo: 'Carla Ospina Duque',
    usuario: 'demo.carla',
    cargo: 'Auxiliar de cocina',
    documento_identidad: '1076543210',
    fecha_ingreso: new Date(Date.UTC(2025, 1, 10)),
    salario: 1_200_000,          // ← por DEBAJO del mínimo: dispara el BLOQUEANTE
    banco: 'Davivienda', tipo_cuenta: 'ahorros', numero_cuenta: '55566677788',
    nivel_riesgo_arl: 'I',
    completo: true,
  },
];

// ─── Limpieza ─────────────────────────────────────────────────────────────────

async function limpiar() {
  const demo = await prisma.usuario.findMany({
    where:  { email: { endsWith: MARCADOR_EMAIL } },
    select: { id: true, nombre_completo: true },
  });
  const ids = demo.map(d => d.id);

  const periodos = await prisma.periodoNomina.findMany({
    where:  { nombre: { startsWith: PREFIJO_PERIODO } },
    select: { id: true, nombre: true },
  });

  // Los detalles, conceptos y novedades caen por cascada con el periodo;
  // los documentos no, porque apuntan al empleado.
  if (ids.length) {
    await prisma.documentoEmitido.deleteMany({ where: { id_empleado: { in: ids } } });
  }
  for (const p of periodos) {
    await prisma.periodoNomina.delete({ where: { id: p.id } });
    console.log(`  ✔ periodo eliminado: ${p.nombre}`);
  }
  if (ids.length) {
    await prisma.historialSalario.deleteMany({ where: { id_usuario: { in: ids } } });
    await prisma.nominaEmpleado.deleteMany({ where: { id_usuario: { in: ids } } });
    await prisma.usuarioGrupo.deleteMany({ where: { id_usuario: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    demo.forEach(d => console.log(`  ✔ usuario eliminado: ${d.nombre_completo}`));
  }

  if (!ids.length && !periodos.length) console.log('  (no había datos de demostración)');
  console.log('\nListo. Los usuarios reales no se tocaron.');
}

// ─── Creación ─────────────────────────────────────────────────────────────────

async function crear() {
  // ── Contexto: sede y rol operativo ─────────────────────────────────────────
  const sede = await prisma.restaurante.findFirst({
    where:   { activo: true },
    orderBy: { id: 'asc' },
    select:  { id: true, nombre: true, id_grupo: true },
  });
  if (!sede) throw new Error('No hay ninguna sede activa. Crea un restaurante primero.');

  const rol = await prisma.rol.findFirst({
    where:   { es_super_admin: false },
    orderBy: { id: 'asc' },
  });
  if (!rol) throw new Error('No hay roles operativos. Corre `npm run seed` primero.');

  const creador = await prisma.usuario.findFirst({
    where:  { es_super_admin: true },
    select: { id: true },
  });
  if (!creador) throw new Error('No hay superadministrador. Corre `npm run seed` primero.');

  console.log(`Sede de nómina: ${sede.nombre} (grupo ${sede.id_grupo})\n`);

  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);

  // ── Consecutivo de empleado: continúa el del grupo ─────────────────────────
  const codigosUsados = await prisma.usuario.findMany({
    where:  { codigo_empleado: { not: null } },
    select: { codigo_empleado: true },
  });
  let siguiente = codigosUsados.reduce((max, { codigo_empleado }) => {
    const m = codigo_empleado?.match(/^EMP-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);

  // ── Empleados ──────────────────────────────────────────────────────────────
  const creados: { id: number; nombre: string; salario: number }[] = [];

  for (const e of EMPLEADOS) {
    siguiente += 1;
    const usuario = await prisma.usuario.create({
      data: {
        nombre_completo: e.nombre_completo,
        email:    `${e.usuario}${MARCADOR_EMAIL}`,
        usuario:  e.usuario,
        password_hash: passwordHash,
        id_rol:   rol.id,
        creado_por: creador.id,
        codigo_empleado: `EMP-${String(siguiente).padStart(4, '0')}`,
        tipo_documento: 'cc',
        documento_identidad: e.documento_identidad,
        cargo: e.cargo,
        fecha_ingreso: e.fecha_ingreso,
        tipo_contrato: 'indefinido',
        jornada: 'completa',
        turno: 'mixto',
        id_restaurante_base: sede.id,
        eps: 'Sura', afp: 'Porvenir', arl: 'Positiva',
        nivel_riesgo_arl: e.nivel_riesgo_arl,
        fondo_cesantias: 'Protección',
        caja_compensacion: 'Compensar',
        contacto_emergencia_nombre: 'Contacto de prueba',
        contacto_emergencia_telefono: '3001112233',
      },
    });

    await prisma.nominaEmpleado.create({
      data: {
        id_usuario: usuario.id,
        salario_base: e.salario,
        tipo_pago: 'mensual',
        banco: e.banco, tipo_cuenta: e.tipo_cuenta, numero_cuenta: e.numero_cuenta,
      },
    });

    // El historial arranca con el salario inicial, igual que lo haría la app
    await prisma.historialSalario.create({
      data: {
        id_usuario: usuario.id,
        salario_anterior: null,
        salario_nuevo: e.salario,
        tipo_pago: 'mensual',
        vigencia_desde: e.fecha_ingreso,
        motivo: 'Salario inicial',
        id_registrado_por: creador.id,
      },
    });

    await prisma.usuarioGrupo.create({
      data: { id_usuario: usuario.id, id_grupo: sede.id_grupo, rol_en_grupo: RolGrupo.operador },
    });

    creados.push({ id: usuario.id, nombre: e.nombre_completo, salario: e.salario });
    console.log(`  ✔ ${usuario.codigo_empleado}  ${e.nombre_completo.padEnd(24)} $${e.salario.toLocaleString('es-CO').padStart(11)}  ${e.numero_cuenta ? '' : '(sin cuenta bancaria)'}`);
  }

  // ── Aprobador: segundo administrador para el control a cuatro ojos ─────────
  // A propósito SIN sede de nómina: su papel es aprobar, no cobrar. Si se le
  // asignara sede entraría en la liquidación y aparecería como bloqueado por
  // no tener salario, ensuciando el semáforo de la prenómina.
  const aprobador = await prisma.usuario.create({
    data: {
      nombre_completo: 'Diego Aprobador',
      email:   `demo.diego${MARCADOR_EMAIL}`,
      usuario: 'demo.diego',
      password_hash: passwordHash,
      id_rol: rol.id,
      creado_por: creador.id,
      cargo: 'Gerente Administrativo',
    },
  });
  await prisma.usuarioGrupo.create({
    data: { id_usuario: aprobador.id, id_grupo: sede.id_grupo, rol_en_grupo: RolGrupo.admin },
  });

  // Necesita el permiso del módulo para poder entrar a Nómina y aprobar
  const permiso = await prisma.permiso.findFirst({ where: { codigo: 'usuarios.gestionar' } });
  if (permiso) {
    await prisma.usuarioPermiso.create({
      data: { id_usuario: aprobador.id, id_permiso: permiso.id },
    });
    console.log(`\n  ✔ Aprobador creado con permiso usuarios.gestionar`);
  } else {
    console.log(`\n  ⚠ No existe el permiso "usuarios.gestionar": el aprobador no podrá entrar al módulo.`);
  }

  // ── Periodo de nómina ──────────────────────────────────────────────────────
  // Marzo 2025: los parámetros de ese año están verificados y permiten liquidar.
  const periodo = await prisma.periodoNomina.create({
    data: {
      nombre: `${PREFIJO_PERIODO} Marzo 2025`,
      tipo_periodo: 'mensual',
      fecha_inicio: new Date(2025, 2, 1),
      fecha_fin:    new Date(2025, 2, 31),
      anio: 2025,
      id_grupo: sede.id_grupo,
      id_restaurante: sede.id,
    },
  });

  // ── Novedades ──────────────────────────────────────────────────────────────
  const ana   = creados[0];
  const bruno = creados[1];

  await prisma.novedadNomina.createMany({
    data: [
      { id_periodo: periodo.id, id_empleado: ana.id, tipo: 'hora_extra_diurna',
        cantidad: 12, valor: 0, observaciones: 'Cierre de mes', id_registrado_por: creador.id },
      { id_periodo: periodo.id, id_empleado: ana.id, tipo: 'recargo_nocturno',
        cantidad: 20, valor: 0, observaciones: 'Turnos nocturnos', id_registrado_por: creador.id },
      { id_periodo: periodo.id, id_empleado: ana.id, tipo: 'prestamo',
        cantidad: 0, valor: 150_000, observaciones: 'Cuota 2 de 6', id_registrado_por: creador.id },
      { id_periodo: periodo.id, id_empleado: bruno.id, tipo: 'incapacidad_comun',
        cantidad: 3, valor: 0, observaciones: 'Incapacidad EPS', id_registrado_por: creador.id },
      { id_periodo: periodo.id, id_empleado: bruno.id, tipo: 'bonificacion',
        cantidad: 0, valor: 100_000, observaciones: 'Bono por desempeño', id_registrado_por: creador.id },
    ],
  });

  console.log(`  ✔ Periodo creado: ${periodo.nombre} (borrador, 5 novedades)\n`);

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log('─'.repeat(64));
  console.log('QUÉ HACER AHORA');
  console.log('─'.repeat(64));
  console.log(`
  1. Entra a  http://localhost:5173  con tu usuario de siempre (@admin).

  2. Administración → Nómina → abre "${periodo.nombre}".
     El semáforo debe mostrar los tres estados:
       · Carla Ospina  → BLOQUEANTE  (salario bajo el mínimo)
       · Bruno Salazar → ADVERTENCIA (sin cuenta bancaria)
       · Ana Restrepo  → sin problemas

  3. Pulsa "Liquidar". Se liquidan 2 de 3 empleados: Carla queda fuera.

  4. Pulsa "Aprobar" TÚ MISMO: debe rechazarlo.
     Es la regla de cuatro ojos funcionando.

  5. Cierra sesión y entra como el aprobador:
       usuario: demo.diego
       clave:   ${PASSWORD_DEMO}
     Vuelve al periodo y apruébalo. Ahora sí.

  6. Con el periodo aprobado, ve a Personal → Ana Restrepo →
     pestaña Documentos → "Desprendible de pago" → Emitir.
     Verás la colilla con sus horas extra, el recargo y el préstamo.

  7. Copia el código de verificación del documento y ábrelo en
       http://localhost:5173/verificar/CODIGO

  Para borrar todo esto:  npm run seed:nomina-demo -- --limpiar
`);
  console.log(`  Contraseña de los 4 usuarios de demostración: ${PASSWORD_DEMO}`);
  console.log(`  (son datos locales de prueba, no credenciales reales)\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const limpiando = process.argv.includes('--limpiar');

  if (limpiando) {
    console.log('\nBorrando datos de demostración…\n');
    await limpiar();
    return;
  }

  const yaExiste = await prisma.usuario.findFirst({
    where: { email: { endsWith: MARCADOR_EMAIL } },
  });
  if (yaExiste) {
    console.log('\n⚠ Ya hay datos de demostración cargados.');
    console.log('  Bórralos primero:  npm run seed:nomina-demo -- --limpiar\n');
    return;
  }

  console.log('\nCreando datos de demostración de nómina…\n');
  await crear();
}

main()
  .catch((e) => { console.error('\n✖', e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
