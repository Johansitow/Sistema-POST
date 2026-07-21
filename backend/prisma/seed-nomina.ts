/**
 * seed-nomina.ts — parámetros legales base del módulo de nómina.
 *
 * IMPORTANTE sobre los valores:
 *   • 2025 se siembra VERIFICADO con las cifras oficiales de Colombia para ese
 *     año (salario mínimo $1.423.500, auxilio de transporte $200.000).
 *   • El año en curso se siembra COPIANDO 2025 y marcado como NO verificado.
 *     El motor se niega a liquidar con parámetros sin verificar, así que nadie
 *     puede liquidar por accidente con el salario mínimo del año pasado.
 *
 * Es deliberado: prefiero que el sistema exija confirmar las cifras oficiales
 * a que calcule en silencio con valores desactualizados.
 *
 * Ejecutar: npm run seed:nomina
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Cifras oficiales de Colombia para 2025. */
const PARAMETROS_2025 = {
  salario_minimo:     1_423_500,
  auxilio_transporte:   200_000,
  tope_auxilio_smmlv:         2,
  uvt:                   49_799,

  porc_salud_empleado:        4,
  porc_pension_empleado:      4,
  porc_salud_empleador:     8.5,
  porc_pension_empleador:    12,
  porc_caja_compensacion:     4,
  porc_icbf:                  3,
  porc_sena:                  2,

  porc_recargo_nocturno:       35,
  porc_extra_diurna:           25,
  porc_extra_nocturna:         75,
  porc_dominical:              75,
  porc_extra_dominical_diurna: 100,

  horas_mensuales: 230,

  porc_cesantias:         8.33,
  porc_interes_cesantias:    1,
  porc_prima:             8.33,
  porc_vacaciones:        4.17,
};

async function main() {
  const anioActual = new Date().getFullYear();

  // ── 2025: cifras oficiales, verificado ──────────────────────────────────────
  await prisma.parametroNomina.upsert({
    where:  { anio: 2025 },
    update: {},   // no se pisa si ya existe: pudo haberse ajustado a mano
    create: {
      anio: 2025,
      ...PARAMETROS_2025,
      verificado: true,
      fecha_verificacion: new Date(),
      notas: 'Cifras oficiales de Colombia para 2025 (salario mínimo $1.423.500, '
           + 'auxilio de transporte $200.000, UVT $49.799).',
    },
  });
  console.log('✔ Parámetros 2025 sembrados (verificados)');

  // ── Año en curso: copia SIN verificar ───────────────────────────────────────
  if (anioActual !== 2025) {
    const existente = await prisma.parametroNomina.findUnique({ where: { anio: anioActual } });

    if (existente) {
      console.log(`• Parámetros ${anioActual} ya existen — no se tocan`);
    } else {
      await prisma.parametroNomina.create({
        data: {
          anio: anioActual,
          ...PARAMETROS_2025,
          verificado: false,
          notas: `⚠️ COPIA de los valores de 2025 — NO son las cifras oficiales de `
               + `${anioActual}. Actualiza el salario mínimo, el auxilio de transporte y `
               + `la UVT con los valores del decreto vigente, y marca como verificado. `
               + `Mientras no se verifique, el sistema no permite liquidar.`,
        },
      });
      console.log(`⚠ Parámetros ${anioActual} creados SIN VERIFICAR — actualiza las cifras oficiales`);
      console.log(`  El sistema NO permitirá liquidar hasta que se verifiquen.`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
