/**
 * Seed de Producción
 * Crea lotes de producción para todos los productos procesados vendibles
 * que tienen stock_actual = 0, permitiendo probar el módulo de órdenes.
 *
 * Ejecutar: npx tsx prisma/seed-produccion.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Asigna cantidad y días de vencimiento según el SKU/nombre del producto */
function resolverConfig(sku: string, nombre: string, stockMinimo?: number | null): { cantidad: number; diasVencimiento: number; merma: number } {
  const s = sku.toLowerCase();
  const n = nombre.toLowerCase();

  // Materias primas procesadas (MPP-): producir 20× el stock mínimo o mínimo 50 unidades
  if (s.startsWith('mpp-')) {
    const base = Math.max(stockMinimo ? stockMinimo * 20 : 50, 50);
    return { cantidad: base, diasVencimiento: 5, merma: 5 };
  }

  // Bebidas embotelladas → mucho stock, larga vida
  if (s.includes('coca') || s.includes('sprite') || s.includes('quatro') || s.includes('agua') || n.includes('gaseosa')) {
    return { cantidad: 60, diasVencimiento: 90, merma: 0 };
  }
  // Jugos y mezclas naturales → stock medio, vida corta
  if (s.includes('jugo') || s.includes('mez')) {
    return { cantidad: 40, diasVencimiento: 3, merma: 5 };
  }
  // Pizzas
  if (s.includes('pizz')) {
    return { cantidad: 12, diasVencimiento: 1, merma: 8 };
  }
  // Strombolis
  if (s.includes('stromb')) {
    return { cantidad: 10, diasVencimiento: 1, merma: 8 };
  }
  // Rolls
  if (s.includes('roll')) {
    return { cantidad: 10, diasVencimiento: 1, merma: 5 };
  }
  // Hamburguesas y platos de carne
  if (s.includes('hmb') || s.includes('hamb') || s.includes('plato') || n.includes('hamburgu')) {
    return { cantidad: 20, diasVencimiento: 1, merma: 5 };
  }
  // Papas
  if (s.includes('pap') || n.includes('papa')) {
    return { cantidad: 25, diasVencimiento: 1, merma: 10 };
  }
  // Arepas y platos de arepa
  if (s.includes('are') || n.includes('arepa')) {
    return { cantidad: 15, diasVencimiento: 1, merma: 5 };
  }
  // Adiciones
  if (s.includes('ad') || n.includes('adición') || n.includes('adicion')) {
    return { cantidad: 50, diasVencimiento: 2, merma: 3 };
  }
  // Menú infantil / combos
  if (s.includes('menu') || n.includes('menú') || n.includes('combo')) {
    return { cantidad: 15, diasVencimiento: 1, merma: 5 };
  }
  // Default: platos preparados
  return { cantidad: 15, diasVencimiento: 1, merma: 5 };
}

async function obtenerSiguienteSecuencia(): Promise<number> {
  const ultimo = await prisma.lote.findFirst({
    orderBy: { numero_lote: 'desc' },
    select: { numero_lote: true },
  });
  if (!ultimo) return 1;
  const match = ultimo.numero_lote.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) + 1 : 1;
}

async function main() {
  console.log('🏭  Creando lotes para todos los productos sin stock...\n');

  const admin = await prisma.usuario.findFirst({
    where: { usuario: 'admin' },
    select: { id: true },
  });
  if (!admin) throw new Error('Usuario admin no encontrado. Ejecuta el seed principal primero.');

  // Obtener TODOS los productos procesados sin stock (vendibles y materias primas procesadas)
  const sinStock = await prisma.producto.findMany({
    where: {
      tipo_materia: 'procesada',
      stock_actual: { lte: 0 },
      estado: { not: 'eliminado' as any },
    },
    select: { id: true, sku: true, nombre: true, stock_actual: true, unidad_medida: true, stock_minimo: true, es_vendible: true },
    orderBy: { sku: 'asc' },
  });

  if (sinStock.length === 0) {
    console.log('✅  Todos los productos ya tienen stock. Nada que hacer.');
    return;
  }

  console.log(`📦  ${sinStock.length} productos sin stock encontrados.\n`);

  let secuencia = await obtenerSiguienteSecuencia();
  let creados = 0;

  for (const producto of sinStock) {
    const { cantidad, diasVencimiento, merma } = resolverConfig(producto.sku, producto.nombre, (producto as any).stock_minimo);
    const numeroLote = `LOTE-${String(secuencia).padStart(6, '0')}`;
    const fechaVencimiento = new Date(Date.now() + diasVencimiento * 24 * 60 * 60 * 1000);
    const stockAnterior = Number(producto.stock_actual);
    const stockNuevo = stockAnterior + cantidad;

    await prisma.$transaction(async (tx) => {
      const lote = await tx.lote.create({
        data: {
          numero_lote: numeroLote,
          id_producto: producto.id,
          cantidad_producida: cantidad,
          fecha_vencimiento: fechaVencimiento,
          estado_lote: 'activo',
          id_usuario_responsable: admin.id,
          observaciones: `Lote producción inicial — ${producto.nombre}`,
          merma_porcentaje: merma,
        },
      });

      await tx.movimiento.create({
        data: {
          id_producto: producto.id,
          tipo_movimiento: 'produccion',
          cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          motivo: `Lote de producción ${numeroLote}`,
          id_lote: lote.id,
        },
      });

      await tx.producto.update({
        where: { id: producto.id },
        data: { stock_actual: stockNuevo },
      });
    });

    console.log(`✅  [${producto.sku}] ${producto.nombre}: ${stockNuevo} ${producto.unidad_medida} (${numeroLote})`);
    secuencia++;
    creados++;
  }

  // Resumen
  const totalProcesados = await prisma.producto.count({ where: { tipo_materia: 'procesada', estado: { not: 'eliminado' as any } } });
  const conStock        = await prisma.producto.count({ where: { tipo_materia: 'procesada', stock_actual: { gt: 0 }, estado: { not: 'eliminado' as any } } });
  const mppConStock     = await prisma.producto.count({ where: { tipo_materia: 'procesada', es_vendible: false, stock_actual: { gt: 0 }, estado: { not: 'eliminado' as any } } });
  const mppTotal        = await prisma.producto.count({ where: { tipo_materia: 'procesada', es_vendible: false, estado: { not: 'eliminado' as any } } });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✨  ${creados} lotes creados`);
  console.log(`🏭  MPP con stock: ${mppConStock}/${mppTotal}`);
  console.log(`🛒  Procesados con stock: ${conStock}/${totalProcesados}`);
  console.log('🚀  ¡Sistema listo para probar el módulo de órdenes!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('❌  Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
