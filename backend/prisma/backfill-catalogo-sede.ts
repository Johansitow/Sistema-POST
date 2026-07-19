/**
 * Backfill: registra cada producto existente en su sede "origen".
 *
 * Contexto: el catálogo pasó a ser POR SUCURSAL — un producto solo es visible
 * en las sedes donde tiene fila ProductoStock activa (cada sede ingresa sus
 * productos desde 0). Los productos creados ANTES de este cambio no tienen
 * fila en ninguna sede (o solo donde registraron movimientos), así que aquí
 * se les crea su fila en la sede default de su grupo para que no desaparezcan.
 *
 * Idempotente: solo crea filas para productos SIN ninguna fila de stock.
 * Ejecutar una vez tras desplegar: npm run backfill:catalogo
 */

import { PrismaClient, EstadoGeneral } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏷️  Backfill catálogo por sede...');

  const productos = await prisma.producto.findMany({
    where:   { estado: { not: EstadoGeneral.eliminado } },
    include: { stocks: { select: { id: true } } },
  });

  const sinSede = productos.filter(p => p.stocks.length === 0);
  console.log(`Productos totales: ${productos.length} — sin sede asignada: ${sinSede.length}`);

  let creadas = 0;
  for (const p of sinSede) {
    // Sede origen: la default del grupo del producto; si no hay, la primera
    // activa del grupo; para productos globales (id_grupo null), la default global.
    const sede =
      (await prisma.restaurante.findFirst({
        where:   { es_default: true, activo: true, ...(p.id_grupo ? { id_grupo: p.id_grupo } : {}) },
      })) ??
      (await prisma.restaurante.findFirst({
        where:   { activo: true, ...(p.id_grupo ? { id_grupo: p.id_grupo } : {}) },
        orderBy: { id: 'asc' },
      }));

    if (!sede) {
      console.warn(`  ⚠️  ${p.sku} "${p.nombre}": sin sede disponible (grupo ${p.id_grupo}) — omitido`);
      continue;
    }

    await prisma.productoStock.create({
      data: {
        id_producto:        p.id,
        id_restaurante:     sede.id,
        stock_actual:       p.stock_actual,
        stock_minimo:       p.stock_minimo,
        stock_maximo:       p.stock_maximo ?? undefined,
        precio_venta_local: p.precio_venta ?? undefined,
        activo:             true,
      },
    });
    creadas++;
    console.log(`  ✔ ${p.sku} "${p.nombre}" → sede "${sede.nombre}" (stock ${p.stock_actual})`);
  }

  console.log(`\nListo: ${creadas} productos registrados en su sede origen.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
