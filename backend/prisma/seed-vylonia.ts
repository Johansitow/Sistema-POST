/**
 * Seed Vylonia Burgers — Datos del menú 2026
 *
 * Agrega de forma segura (upsert por SKU) las categorías y productos:
 *   • Materias Primas       (tipo_materia: 'prima',     es_vendible: false)
 *   • Materias P. Procesada (tipo_materia: 'procesada', es_vendible: false)
 *   • Productos Terminados  (tipo_materia: 'procesada', es_vendible: true)
 *
 * NO borra datos existentes. Se puede correr varias veces sin riesgo.
 * Ejecutar: npm run seed:vylonia
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Helper upsert categoria ──────────────────────────────────────────────────
async function upsertCat(nombre: string, descripcion: string, orden: number) {
  return prisma.categoria.upsert({
    where:  { nombre },
    update: { descripcion, orden },
    create: { nombre, descripcion, orden },
  });
}

// ─── Helper upsert producto ───────────────────────────────────────────────────
type ProdData = Parameters<PrismaClient['producto']['upsert']>[0]['create'];

async function upsertProd(data: ProdData) {
  return prisma.producto.upsert({
    where:  { sku: data.sku as string },
    update: {
      nombre:                 data.nombre,
      descripcion:            data.descripcion,
      id_categoria:           data.id_categoria,
      tipo_materia:           data.tipo_materia,
      unidad_medida:          data.unidad_medida,
      precio_unitario:        data.precio_unitario,
      precio_venta:           data.precio_venta,
      stock_minimo:           data.stock_minimo,
      requiere_refrigeracion: data.requiere_refrigeracion,
      es_vendible:            data.es_vendible,
    },
    create: data,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seed Vylonia Burgers — iniciando...\n');

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍAS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('📁 Creando categorías...');

  // Materias primas — grupos
  const catLacteos    = await upsertCat('Lácteos',               'Quesos, cremas y lácteos',                   1);
  const catCarnicos   = await upsertCat('Cárnicos y Embutidos',  'Carnes, chorizos, tocineta y embutidos',      2);
  const catVerduras   = await upsertCat('Verduras y Hortalizas', 'Verduras, hortalizas y hongos',               3);
  const catFrutas     = await upsertCat('Frutas',                'Frutas frescas',                              4);
  const catPanaderia  = await upsertCat('Panadería y Harinas',   'Arepas, panes, harinas y almidones',          5);
  const catEspecias   = await upsertCat('Especias y Condimentos','Especias, vinagres y conservantes',           6);
  const catAceites    = await upsertCat('Aceites y Grasas',      'Aceites, vinos y grasas de cocina',           7);
  const catEndulz     = await upsertCat('Endulzantes y Dulces',  'Panela, miel, azúcar, nutella y arequipe',    8);
  const catHuevos     = await upsertCat('Huevos y Proteínas',    'Huevos de gallina y codorniz',                9);

  // Categorías de productos procesados y terminados
  const catMPP        = await upsertCat('Materia Prima Procesada','Ingredientes elaborados en cocina',          10);
  const catEntradas   = await upsertCat('Entradas',              'Pal arranque — entradas de la carta',         11);
  const catHamburg    = await upsertCat('Hamburguesas',          'Hamburguesas de la carta Vylonia',            12);
  const catPapas      = await upsertCat('Papas',                 'Papas en casco y variaciones',                13);
  const catPizzas     = await upsertCat('Pizzas',                'Pizzas artesanales de la casa',               14);
  const catRolls      = await upsertCat('Rolls y Stromboli',     'Rolls y stromboli de masa napolitana',        15);
  const catBebidas    = await upsertCat('Bebidas',               'Aguas, gaseosas, jugos y mezclas',            16);
  const catMenuInf    = await upsertCat('Menú Infantil',         'Menú para los más pequeños',                  17);
  const catAdiciones  = await upsertCat('Adiciones',            'Adiciones individuales a los platos',          18);

  console.log('✅ 18 categorías listas\n');

  // ══════════════════════════════════════════════════════════════════════════
  // MATERIAS PRIMAS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🥩 Creando materias primas...');

  // ── Lácteos ────────────────────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-CHEDDAR',  nombre: 'Queso Cheddar',      id_categoria: catLacteos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 28000, stock_actual: 5,  stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-MOZARELL', nombre: 'Queso Mozzarella',   id_categoria: catLacteos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 25000, stock_actual: 8,  stock_minimo: 3,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-QCREMA',   nombre: 'Queso Crema',        id_categoria: catLacteos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 22000, stock_actual: 3,  stock_minimo: 1,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-QBUFALA',  nombre: 'Queso di Búfala',    id_categoria: catLacteos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 55000, stock_actual: 2,  stock_minimo: 1,  requiere_refrigeracion: true, descripcion: 'Bocconcini di bufala para pizza siciliana' });
  await upsertProd({ sku: 'MP-BURRATA',  nombre: 'Burrata de Búfala',  id_categoria: catLacteos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 65000, stock_actual: 1,  stock_minimo: 1,  requiere_refrigeracion: true, descripcion: 'Para pizza al pesto' });
  await upsertProd({ sku: 'MP-CREMALE',  nombre: 'Crema de Leche',     id_categoria: catLacteos.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 8500,  stock_actual: 5,  stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-LECHEENT', nombre: 'Leche Entera',       id_categoria: catLacteos.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 4500,  stock_actual: 10, stock_minimo: 4,  requiere_refrigeracion: true });

  // ── Cárnicos y Embutidos ──────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-CHORIZO',   nombre: 'Chorizo',            id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 18000, stock_actual: 10, stock_minimo: 3,  requiere_refrigeracion: true, descripcion: 'Chorizo 100% premium de la casa (insumo base)' });
  await upsertProd({ sku: 'MP-PECHUGA',   nombre: 'Pechuga de Pollo',   id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 12000, stock_actual: 15, stock_minimo: 5,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-PANCETA',   nombre: 'Panceta de Cerdo',   id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 16000, stock_actual: 8,  stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-SALMUERA',  nombre: 'Salmuera',           id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 2000,  stock_actual: 5,  stock_minimo: 2,  descripcion: 'Para curado de carnes y tocineta' });
  await upsertProd({ sku: 'MP-TOCINETA',  nombre: 'Tocineta',           id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 22000, stock_actual: 8,  stock_minimo: 3,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-PROSCIUT',  nombre: 'Prosciutto',         id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 75000, stock_actual: 2,  stock_minimo: 1,  requiere_refrigeracion: true, descripcion: 'Para pizza al pesto' });
  await upsertProd({ sku: 'MP-PEPPERONI', nombre: 'Pepperoni',          id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 32000, stock_actual: 5,  stock_minimo: 2,  requiere_refrigeracion: true, descripcion: 'Pepperoni italiano para pizzas y rolls' });
  await upsertProd({ sku: 'MP-CARNEREZ',  nombre: 'Carne de Res Molida', id_categoria: catCarnicos.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 22000, stock_actual: 20, stock_minimo: 8,  requiere_refrigeracion: true, descripcion: 'Carne de res molida 100% premium para hamburguesas' });

  // ── Verduras y Hortalizas ─────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-TOMATE',    nombre: 'Tomate',             id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 3500,  stock_actual: 15, stock_minimo: 5  });
  await upsertProd({ sku: 'MP-CEBOLLA',   nombre: 'Cebolla',            id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 2500,  stock_actual: 20, stock_minimo: 8  });
  await upsertProd({ sku: 'MP-CEBOLLIN',  nombre: 'Cebollín',           id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 4000,  stock_actual: 5,  stock_minimo: 2  });
  await upsertProd({ sku: 'MP-TOMCHERRY', nombre: 'Tomates Cherry',     id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 8000,  stock_actual: 3,  stock_minimo: 1,  requiere_refrigeracion: true, descripcion: 'Para pizza al pesto' });
  await upsertProd({ sku: 'MP-TOMSMANZ',  nombre: 'Tomate San Manzano', id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 9000,  stock_actual: 5,  stock_minimo: 2,  descripcion: 'Para pizza siciliana' });
  await upsertProd({ sku: 'MP-CHAMPINON', nombre: 'Champiñones',        id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 12000, stock_actual: 4,  stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-PEPINILLO', nombre: 'Pepinillos',         id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 7000,  stock_actual: 5,  stock_minimo: 2,  descripcion: 'Pepinillos en vinagre' });
  await upsertProd({ sku: 'MP-AJO',       nombre: 'Ajo',                id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 6000,  stock_actual: 5,  stock_minimo: 2  });
  await upsertProd({ sku: 'MP-PAPA',      nombre: 'Papa',               id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 2000,  stock_actual: 50, stock_minimo: 15 });
  await upsertProd({ sku: 'MP-MAIZTI',    nombre: 'Maíz Tierno',        id_categoria: catVerduras.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 3500,  stock_actual: 8,  stock_minimo: 3,  descripcion: 'Maíz tierno en grano (pizza criolla)' });

  // ── Frutas ────────────────────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-PIÑA',      nombre: 'Piña',               id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 3500,  stock_actual: 10, stock_minimo: 4  });
  await upsertProd({ sku: 'MP-MANZANAV',  nombre: 'Manzana Verde',      id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 7000,  stock_actual: 8,  stock_minimo: 3  });
  await upsertProd({ sku: 'MP-PLATMAD',   nombre: 'Plátano Maduro',     id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 2500,  stock_actual: 10, stock_minimo: 4  });
  await upsertProd({ sku: 'MP-FRESA',     nombre: 'Fresas',             id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 9000,  stock_actual: 5,  stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-NARANJA',   nombre: 'Naranja',            id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 3000,  stock_actual: 10, stock_minimo: 4  });
  await upsertProd({ sku: 'MP-MANGO',     nombre: 'Mango',              id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 5000,  stock_actual: 8,  stock_minimo: 3  });
  await upsertProd({ sku: 'MP-MARACUYA',  nombre: 'Maracuyá',           id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 6000,  stock_actual: 5,  stock_minimo: 2  });
  await upsertProd({ sku: 'MP-MANDARIN',  nombre: 'Mandarina',          id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 4000,  stock_actual: 8,  stock_minimo: 3  });
  await upsertProd({ sku: 'MP-GUANABAN',  nombre: 'Guanábana',          id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 7000,  stock_actual: 5,  stock_minimo: 2  });
  await upsertProd({ sku: 'MP-MORA',      nombre: 'Mora',               id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 8000,  stock_actual: 5,  stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-LIMON',     nombre: 'Limón',              id_categoria: catFrutas.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 3500,  stock_actual: 8,  stock_minimo: 3  });

  // ── Panadería y Harinas ───────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-AREPA',     nombre: 'Arepa de Maíz',      id_categoria: catPanaderia.id, tipo_materia: 'prima', unidad_medida: 'unidad',    precio_unitario: 800,   stock_actual: 50, stock_minimo: 20 });
  await upsertProd({ sku: 'MP-PANKO',     nombre: 'Panko',              id_categoria: catPanaderia.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 9000,  stock_actual: 5,  stock_minimo: 2,  descripcion: 'Pan rallado japonés para apanados' });
  await upsertProd({ sku: 'MP-MAIZENA',   nombre: 'Maizena',            id_categoria: catPanaderia.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 4500,  stock_actual: 5,  stock_minimo: 2  });
  await upsertProd({ sku: 'MP-SOJA',      nombre: 'Soja',               id_categoria: catPanaderia.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 5000,  stock_actual: 5,  stock_minimo: 2  });

  // ── Huevos ────────────────────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-HUEVO',     nombre: 'Huevos',             id_categoria: catHuevos.id, tipo_materia: 'prima', unidad_medida: 'unidad',    precio_unitario: 600,   stock_actual: 60, stock_minimo: 20, requiere_refrigeracion: true });
  await upsertProd({ sku: 'MP-HCODORNI',  nombre: 'Huevo de Codorniz',  id_categoria: catHuevos.id, tipo_materia: 'prima', unidad_medida: 'unidad',    precio_unitario: 350,   stock_actual: 50, stock_minimo: 15, requiere_refrigeracion: true });

  // ── Especias y Condimentos ────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-CANAST',    nombre: 'Canela (Astilla)',   id_categoria: catEspecias.id, tipo_materia: 'prima', unidad_medida: 'gramo',     precio_unitario: 80,    stock_actual: 200, stock_minimo: 50 });
  await upsertProd({ sku: 'MP-CANPOL',    nombre: 'Canela en Polvo',    id_categoria: catEspecias.id, tipo_materia: 'prima', unidad_medida: 'gramo',     precio_unitario: 60,    stock_actual: 300, stock_minimo: 100 });
  await upsertProd({ sku: 'MP-VINAGRE',   nombre: 'Vinagre',            id_categoria: catEspecias.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 3500,  stock_actual: 5,  stock_minimo: 2  });
  await upsertProd({ sku: 'MP-SIRACHA',   nombre: 'Sriracha',           id_categoria: catEspecias.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 22000, stock_actual: 3,  stock_minimo: 1  });

  // ── Aceites y Grasas ──────────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-ACEITE',    nombre: 'Aceite',             id_categoria: catAceites.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 8000,  stock_actual: 10, stock_minimo: 4  });
  await upsertProd({ sku: 'MP-ACTRUF',    nombre: 'Aceite de Trufas',   id_categoria: catAceites.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 90000, stock_actual: 1,  stock_minimo: 1,  descripcion: 'Para pizza quesos de la casa' });
  await upsertProd({ sku: 'MP-VINO',      nombre: 'Vino',               id_categoria: catAceites.id, tipo_materia: 'prima', unidad_medida: 'litro',     precio_unitario: 18000, stock_actual: 3,  stock_minimo: 1,  descripcion: 'Para manzana reducida y pizza de manzana' });

  // ── Endulzantes y Dulces ──────────────────────────────────────────────────
  await upsertProd({ sku: 'MP-PANELA',    nombre: 'Panela',             id_categoria: catEndulz.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 3500,  stock_actual: 10, stock_minimo: 4  });
  await upsertProd({ sku: 'MP-MIEL',      nombre: 'Miel',               id_categoria: catEndulz.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 28000, stock_actual: 3,  stock_minimo: 1  });
  await upsertProd({ sku: 'MP-AZUPOL',    nombre: 'Azúcar en Polvo',    id_categoria: catEndulz.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 6000,  stock_actual: 5,  stock_minimo: 2  });
  await upsertProd({ sku: 'MP-NUTELLA',   nombre: 'Nutella',            id_categoria: catEndulz.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 35000, stock_actual: 3,  stock_minimo: 1  });
  await upsertProd({ sku: 'MP-AREQUIP',   nombre: 'Arequipe',           id_categoria: catEndulz.id, tipo_materia: 'prima', unidad_medida: 'kilogramo', precio_unitario: 12000, stock_actual: 5,  stock_minimo: 2  });

  console.log('✅ 50 materias primas creadas\n');

  // ══════════════════════════════════════════════════════════════════════════
  // MATERIAS PRIMAS PROCESADAS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🍳 Creando materias primas procesadas...');

  await upsertProd({ sku: 'MPP-SALCASA',   nombre: 'Salsa de la Casa',             id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'litro',     precio_unitario: 0, stock_actual: 0, stock_minimo: 1, descripcion: 'Salsa signature de Vylonia Burgers' });
  await upsertProd({ sku: 'MPP-HCODO',     nombre: 'Huevos de Codorniz (cocidos)', id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'unidad',    precio_unitario: 0, stock_actual: 0, stock_minimo: 10, requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-CARNDES',   nombre: 'Carne Desmechada',             id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  requiere_refrigeracion: true, descripcion: 'Carne de res mechada con guiso criollo' });
  await upsertProd({ sku: 'MPP-CEBCARAMEL',nombre: 'Cebolla Caramelizada',         id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  descripcion: 'Cebolla caramelizada en vino tinto' });
  await upsertProd({ sku: 'MPP-TOCARTESA', nombre: 'Tocineta Artesanal de la Casa',id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  requiere_refrigeracion: true, descripcion: 'Tocineta curada y ahumada artesanalmente' });
  await upsertProd({ sku: 'MPP-PAPASCASA', nombre: 'Papas de la Casa',             id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'porcion',   precio_unitario: 0, stock_actual: 0, stock_minimo: 5,  descripcion: '600g de papa en casco lista para servir' });
  await upsertProd({ sku: 'MPP-CREMCEBOL', nombre: 'Crema Cebollín',              id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  requiere_refrigeracion: true, descripcion: 'Mezcla de queso crema, cebollín y tocineta' });
  await upsertProd({ sku: 'MPP-PASTAAJO',  nombre: 'Pasta de Ajo',                id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1  });
  await upsertProd({ sku: 'MPP-SALEMI',    nombre: 'Salsa Emi',                   id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'litro',     precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  descripcion: 'Salsa premium con nivel de picor tolerable' });
  await upsertProd({ sku: 'MPP-SALNAP',    nombre: 'Salsa Napolitana',            id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'litro',     precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  descripcion: 'Base de tomate para pizzas' });
  await upsertProd({ sku: 'MPP-REDBALS',   nombre: 'Reducción Balsámica',         id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'litro',     precio_unitario: 0, stock_actual: 0, stock_minimo: 1  });
  await upsertProd({ sku: 'MPP-MANZVINO',  nombre: 'Manzana Reducida con Vino',   id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  descripcion: 'Manzana verde caramelizada con vino' });
  await upsertProd({ sku: 'MPP-MASAPIZ',   nombre: 'Masa para Pizza de la Casa',  id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  descripcion: 'Masa napolitana artesanal' });
  await upsertProd({ sku: 'MPP-PIÑACAR',   nombre: 'Piña Caramelizada',           id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1  });
  await upsertProd({ sku: 'MPP-SALPESTO',  nombre: 'Salsa Pesto',                 id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'litro',     precio_unitario: 0, stock_actual: 0, stock_minimo: 1  });
  await upsertProd({ sku: 'MPP-SALQUESO',  nombre: 'Salsa Queso de la Casa',      id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'litro',     precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  descripcion: 'Salsa cheddar cremosa con pimienta y miel' });
  await upsertProd({ sku: 'MPP-MIELSIR',   nombre: 'Miel de Sriracha',            id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'litro',     precio_unitario: 0, stock_actual: 0, stock_minimo: 1,  descripcion: 'Para toping de rolls de pepperoni' });
  await upsertProd({ sku: 'MPP-TOMLIMON',  nombre: 'Tomate en Reducción de Limonaria', id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 1, requiere_refrigeracion: true, descripcion: 'Tomate en rodajas marinado con reducción de limonaria, acompañante de hamburguesas' });
  // Pulpas
  await upsertProd({ sku: 'MPP-PULPMORA',  nombre: 'Pulpa de Mora',               id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-PULPMAN',   nombre: 'Pulpa de Mango',              id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-PULPMAR',   nombre: 'Pulpa de Maracuyá',           id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-PULPGUA',   nombre: 'Pulpa de Guanábana',          id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-PULPFRE',   nombre: 'Pulpa de Fresa',              id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-PULPPIÑA',  nombre: 'Pulpa de Piña',               id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-PULPMANDR', nombre: 'Pulpa de Mandarina',          id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });
  await upsertProd({ sku: 'MPP-PULPNAR',   nombre: 'Pulpa de Naranja',            id_categoria: catMPP.id, tipo_materia: 'procesada', unidad_medida: 'kilogramo', precio_unitario: 0, stock_actual: 0, stock_minimo: 2,  requiere_refrigeracion: true });

  console.log('✅ 26 materias primas procesadas creadas\n');

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCTOS TERMINADOS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🍔 Creando productos terminados...');

  // ── Entradas / Pal Arranque ───────────────────────────────────────────────
  await upsertProd({ sku: 'PT-ARECHOR',   nombre: 'Arepa con Chorizo',            id_categoria: catEntradas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 8500,  stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Arepa de maíz, chorizo 100% premium de la casa' });
  await upsertProd({ sku: 'PT-ARERELL',   nombre: 'Arepa Rellena de Chorizo',     id_categoria: catEntradas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 11000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Arepa de maíz rellena de chorizo (Dulce picante, Jalapeño o Tradicional), maíz dulce y queso' });
  await upsertProd({ sku: 'PT-ARECARNE',  nombre: 'Arepa con Carne Mechada',      id_categoria: catEntradas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 14000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Arepa de maíz, carne mechada con guiso criollo, salsa de la casa, chorizo, queso y huevo de codorniz' });
  await upsertProd({ sku: 'PT-CEVCHOR',   nombre: 'Ceviche de Chorizo',           id_categoria: catEntradas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 14000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Chorizo 100% premium en salsa de la casa, chips de plátano, cebollas en juliana y tomate en brunoise' });
  await upsertProd({ sku: 'PT-DEDQUESO',  nombre: 'Deditos de Queso',             id_categoria: catEntradas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 15000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: '5 deditos de queso mozzarella apanados en panko, con salsas de la casa' });
  await upsertProd({ sku: 'PT-CHTEND',    nombre: 'Chicken Tenders',              id_categoria: catEntradas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 22000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Trozos de pechuga apanados con miel mostaza y salsa de la casa' });
  await upsertProd({ sku: 'PT-PLATCHOR',  nombre: 'Plátano Maduro con Chorizo',   id_categoria: catEntradas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 13000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Plátano maduro cubierto en queso y chorizo 100% premium de la casa' });

  // ── Hamburguesas ──────────────────────────────────────────────────────────
  await upsertProd({ sku: 'PT-HMBMIST',  nombre: 'Mística',    id_categoria: catHamburg.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 19000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Pan brioche de papa, queso cheddar, 150g carne 100% premium, cebolla caramelizada, tomate en reducción de limonaria, pepinillos, tocineta y salsa de la casa' });
  await upsertProd({ sku: 'PT-HMBMAL',   nombre: 'Maléfica',   id_categoria: catHamburg.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 21000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Pan brioche, queso cheddar, 150g carne 100% premium, tocineta, manzana verde caramelizada, cebolla caramelizada, tomate en reducción de limonaria y salsa de la casa' });
  await upsertProd({ sku: 'PT-HMBVIU',   nombre: 'Viuda Negra', id_categoria: catHamburg.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 22000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Pan brioche de papa, queso cheddar, 150g pechuga de pollo apanada, cebolla caramelizada, tomate en reducción de limonaria, tocineta y salsa de la casa' });
  await upsertProd({ sku: 'PT-HMBMED',   nombre: 'Medusa',     id_categoria: catHamburg.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 22000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Pan brioche de papa, queso cheddar, 150g carne 100% premium cubierta en tiras de tocineta crujiente, cebolla caramelizada, tomate en reducción de limonaria y salsa de la casa' });
  await upsertProd({ sku: 'PT-HMBURS',   nombre: 'Úrsula',     id_categoria: catHamburg.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 24000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Pan brioche de papa, 150g carne 100% premium, crema cebollín y tocineta, pepinillos, tomate en reducción de limonaria y salsa de la casa' });
  await upsertProd({ sku: 'PT-HMBCRU',   nombre: 'Cruella',    id_categoria: catHamburg.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 26000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Pan brioche de papa, doble queso cheddar, dos carnes de res de 150g 100% premium, cebolla caramelizada, tomate en reducción de limonaria, tocineta y salsa de la casa' });
  await upsertProd({ sku: 'PT-HMBNEB',   nombre: 'Nebula',     id_categoria: catHamburg.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 25000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Pan brioche de papa, queso cheddar, 150g carne 100% premium, cebolla caramelizada, tomate en reducción de limonaria, tocineta y Salsa Emi premium con nivel de picor tolerable' });

  // ── Papas ─────────────────────────────────────────────────────────────────
  await upsertProd({ sku: 'PT-PAPSEN',    nombre: 'Papas Sencillas',      id_categoria: catPapas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 6000,  stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: '400g de papa en casco con salsa de la casa' });
  await upsertProd({ sku: 'PT-PAPCOMP',   nombre: 'Papas para Compartir', id_categoria: catPapas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 15000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: '600g de papa en casco con salsa de la casa' });
  await upsertProd({ sku: 'PT-PAPBRAV',   nombre: 'Papas Bravas',         id_categoria: catPapas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 17000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: '600g de papa en casco cubiertas en salsa amarilla picosa y trozos de tocineta crush' });
  await upsertProd({ sku: 'PT-PAPCHED',   nombre: 'Papas Cheddar Tocino', id_categoria: catPapas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: '600g de papa en casco cubiertas en salsa cheddar y tocino, con salsa de la casa' });
  await upsertProd({ sku: 'PT-CHORPAP',   nombre: 'Chori Papas',          id_categoria: catPapas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 20000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: '600g de papa en casco, chorizo de la casa y salsa de la casa' });
  await upsertProd({ sku: 'PT-PAPCASA',   nombre: 'Papas de la Casa',     id_categoria: catPapas.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 25000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: '600g de papa en casco, carne desmechada, queso doble crema en cubos y salsa de ajo' });

  // ── Pizzas ────────────────────────────────────────────────────────────────
  // Manzana
  await upsertProd({ sku: 'PT-PIZZMANZP', nombre: 'Pizza de Manzana (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 22000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, manzana cocinada al vino y caramelizada, tocineta, reducción balsámica' });
  await upsertProd({ sku: 'PT-PIZZMANZM', nombre: 'Pizza de Manzana (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 33000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, manzana caramelizada al vino, tocineta, reducción balsámica' });
  await upsertProd({ sku: 'PT-PIZZMANZF', nombre: 'Pizza de Manzana (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 46000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, manzana caramelizada al vino, tocineta, reducción balsámica' });
  // Siciliana
  await upsertProd({ sku: 'PT-PIZZSICP', nombre: 'Pizza Siciliana (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 22000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, tomate san manzano, bocconcini di bufala, pepperoni de mezcla de la casa' });
  await upsertProd({ sku: 'PT-PIZZSICM', nombre: 'Pizza Siciliana (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 33000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, tomate san manzano, bocconcini di bufala, pepperoni de mezcla de la casa' });
  await upsertProd({ sku: 'PT-PIZZSICF', nombre: 'Pizza Siciliana (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 46000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, tomate san manzano, bocconcini di bufala, pepperoni de mezcla de la casa' });
  // Hawaiana
  await upsertProd({ sku: 'PT-PIZZHAWP', nombre: 'Pizza Hawaiana (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, piña caramelizada artesanal, tocineta premium' });
  await upsertProd({ sku: 'PT-PIZZHAWM', nombre: 'Pizza Hawaiana (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 30000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, piña caramelizada artesanal, tocineta premium' });
  await upsertProd({ sku: 'PT-PIZZHAWF', nombre: 'Pizza Hawaiana (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 44000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, piña caramelizada artesanal, tocineta premium' });
  // Pollo y Champiñones
  await upsertProd({ sku: 'PT-PIZZPCHP', nombre: 'Pizza Pollo y Champiñones (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, pollo a la plancha y champiñones salteados' });
  await upsertProd({ sku: 'PT-PIZZPCHM', nombre: 'Pizza Pollo y Champiñones (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 30000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, pollo a la plancha y champiñones salteados' });
  await upsertProd({ sku: 'PT-PIZZPCHF', nombre: 'Pizza Pollo y Champiñones (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 44000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, pollo a la plancha y champiñones salteados' });
  // Pesto
  await upsertProd({ sku: 'PT-PIZZPESP', nombre: 'Pizza al Pesto (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 24000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa pesto, burrata de búfala, tomates cherry, prosciutto y mozzarella' });
  await upsertProd({ sku: 'PT-PIZZPESM', nombre: 'Pizza al Pesto (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 36000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa pesto, burrata de búfala, tomates cherry, prosciutto y mozzarella' });
  await upsertProd({ sku: 'PT-PIZZPESF', nombre: 'Pizza al Pesto (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 55000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa pesto, burrata de búfala, tomates cherry, prosciutto y mozzarella' });
  // Quesos de la Casa
  await upsertProd({ sku: 'PT-PIZZQCSP', nombre: 'Pizza Quesos de la Casa (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 24000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, base de crema de leche con pimienta y miel, queso pecorino, mozzarella y aceite de trufa' });
  await upsertProd({ sku: 'PT-PIZZQCSM', nombre: 'Pizza Quesos de la Casa (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 36000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, base de crema de leche con pimienta y miel, queso pecorino, mozzarella y aceite de trufa' });
  await upsertProd({ sku: 'PT-PIZZQCSF', nombre: 'Pizza Quesos de la Casa (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 55000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, base de crema de leche con pimienta y miel, queso pecorino, mozzarella y aceite de trufa' });
  // Criolla
  await upsertProd({ sku: 'PT-PIZZCRIOP', nombre: 'Pizza Criolla (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, carne desmechada con guiso criollo, maíz tierno y chorizo de la casa' });
  await upsertProd({ sku: 'PT-PIZZCRIOM', nombre: 'Pizza Criolla (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 30000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, carne desmechada con guiso criollo, maíz tierno y chorizo de la casa' });
  await upsertProd({ sku: 'PT-PIZZCRIOF', nombre: 'Pizza Criolla (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 44000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella, carne desmechada con guiso criollo, maíz tierno y chorizo de la casa' });
  // Pepperoni
  await upsertProd({ sku: 'PT-PIZZPEPP', nombre: 'Pizza de Pepperoni (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella y pepperoni italiano' });
  await upsertProd({ sku: 'PT-PIZZPEPM', nombre: 'Pizza de Pepperoni (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 30000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella y pepperoni italiano' });
  await upsertProd({ sku: 'PT-PIZZPEPF', nombre: 'Pizza de Pepperoni (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 44000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, salsa napolitana, mozzarella y pepperoni italiano' });
  // Dulce
  await upsertProd({ sku: 'PT-PIZZDULP', nombre: 'Pizza Dulce (Personal)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, crema de avellanas (Nutella), fresas frescas' });
  await upsertProd({ sku: 'PT-PIZZDULM', nombre: 'Pizza Dulce (Mediana)',  id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 30000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, crema de avellanas (Nutella), fresas frescas' });
  await upsertProd({ sku: 'PT-PIZZDULF', nombre: 'Pizza Dulce (Familiar)', id_categoria: catPizzas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 44000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Masa de la casa, crema de avellanas (Nutella), fresas frescas' });

  // ── Rolls y Stromboli ─────────────────────────────────────────────────────
  await upsertProd({ sku: 'PT-ROLLCAN6',  nombre: 'Rolls de Canela (6 und)',      id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 11000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollos de masa de pizza napolitana rellenos de canela y queso mozzarella' });
  await upsertProd({ sku: 'PT-ROLLCAN12', nombre: 'Rolls de Canela (12 und)',     id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 21000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollos de masa de pizza napolitana rellenos de canela y queso mozzarella' });
  await upsertProd({ sku: 'PT-ROLLPEP6',  nombre: 'Rolls de Pepperoni (6 und)',   id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 14000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollos de masa napolitana rellenos de pepperoni y mozzarella, toping de queso stracciatella y miel de sriracha' });
  await upsertProd({ sku: 'PT-ROLLPEP12', nombre: 'Rolls de Pepperoni (12 und)',  id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 24000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollos de masa napolitana rellenos de pepperoni y mozzarella, toping de queso stracciatella y miel de sriracha' });
  await upsertProd({ sku: 'PT-ROLLDUC6',  nombre: 'Rolls Dulces (6 und)',         id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 11000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollos de masa de pizza napolitana rellenos de arequipe y queso mozzarella' });
  await upsertProd({ sku: 'PT-ROLLDUC12', nombre: 'Rolls Dulces (12 und)',        id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 21000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollos de masa de pizza napolitana rellenos de arequipe y queso mozzarella' });
  // Eliminar Stromboli genérico legacy (reemplazado por versiones por sabor)
  await prisma.producto.deleteMany({ where: { sku: { in: ['PT-STROMBP', 'PT-STROMBM'] } } });
  // Stromboli — 4 sabores × 2 tamaños
  await upsertProd({ sku: 'PT-STROMB-PEPP-P', nombre: 'Stromboli Pepperoni (Personal)', id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de pepperoni italiano y queso mozzarella' });
  await upsertProd({ sku: 'PT-STROMB-PEPP-M', nombre: 'Stromboli Pepperoni (Mediano)',  id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 27000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de pepperoni italiano y queso mozzarella' });
  await upsertProd({ sku: 'PT-STROMB-ITAL-P', nombre: 'Stromboli Italiano (Personal)',  id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de jamón serrano, pimentones asados y mozzarella al estilo italiano' });
  await upsertProd({ sku: 'PT-STROMB-ITAL-M', nombre: 'Stromboli Italiano (Mediano)',   id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 27000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de jamón serrano, pimentones asados y mozzarella al estilo italiano' });
  await upsertProd({ sku: 'PT-STROMB-CRIO-P', nombre: 'Stromboli Criollo (Personal)',   id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de pollo desmechado, papa criolla y queso crema estilo criollo' });
  await upsertProd({ sku: 'PT-STROMB-CRIO-M', nombre: 'Stromboli Criollo (Mediano)',    id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 27000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de pollo desmechado, papa criolla y queso crema estilo criollo' });
  await upsertProd({ sku: 'PT-STROMB-HAW-P',  nombre: 'Stromboli Hawaiano (Personal)',  id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 18000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de jamón dulce, piña y queso mozzarella' });
  await upsertProd({ sku: 'PT-STROMB-HAW-M',  nombre: 'Stromboli Hawaiano (Mediano)',   id_categoria: catRolls.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 27000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Rollo completo de masa napolitana relleno de jamón dulce, piña y queso mozzarella' });

  // ── Bebidas ───────────────────────────────────────────────────────────────
  await upsertProd({ sku: 'PT-AGUANAT',   nombre: 'Agua Natural',              id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 4900,  stock_actual: 0, stock_minimo: 10, es_vendible: true });
  await upsertProd({ sku: 'PT-AGUAGAS',   nombre: 'Agua con Gas',              id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 4900,  stock_actual: 0, stock_minimo: 10, es_vendible: true });
  await upsertProd({ sku: 'PT-SPRITE',    nombre: 'Sprite 400ml',              id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 4900,  stock_actual: 0, stock_minimo: 10, es_vendible: true });
  await upsertProd({ sku: 'PT-COCACERO',  nombre: 'Coca Cola Cero 400ml',      id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 4900,  stock_actual: 0, stock_minimo: 10, es_vendible: true });
  await upsertProd({ sku: 'PT-COCACOLA',  nombre: 'Coca Cola 400ml',           id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 4900,  stock_actual: 0, stock_minimo: 10, es_vendible: true });
  await upsertProd({ sku: 'PT-QUATRO',    nombre: 'Quatro 400ml',              id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 4900,  stock_actual: 0, stock_minimo: 10, es_vendible: true });
  await upsertProd({ sku: 'PT-COCA15',    nombre: 'Coca Cola 1.5L',            id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 8500,  stock_actual: 0, stock_minimo: 6,  es_vendible: true });
  await upsertProd({ sku: 'PT-MEZNARPI',  nombre: 'Mezcla Naranja-Piña 500ml', id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 10000, stock_actual: 0, stock_minimo: 0,  es_vendible: true });
  await upsertProd({ sku: 'PT-MEZFREMA',  nombre: 'Mezcla Fresa-Mandarina 500ml',   id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 10000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-MEZMANGMA', nombre: 'Mezcla Mango-Mandarina 500ml',   id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 10000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-MEZMARMAN', nombre: 'Mezcla Maracuyá-Mango 500ml',    id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 10000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-JUGOMAN',   nombre: 'Jugo de Mango 500ml',       id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 6900,  stock_actual: 0, stock_minimo: 0,  es_vendible: true });
  await upsertProd({ sku: 'PT-JUGOFRE',   nombre: 'Jugo de Fresa 500ml',       id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 6900,  stock_actual: 0, stock_minimo: 0,  es_vendible: true });
  await upsertProd({ sku: 'PT-JUGOGU',    nombre: 'Jugo de Guanábana 500ml',   id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 6900,  stock_actual: 0, stock_minimo: 0,  es_vendible: true });
  await upsertProd({ sku: 'PT-JUGOMOR',   nombre: 'Jugo de Mora 500ml',        id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 6900,  stock_actual: 0, stock_minimo: 0,  es_vendible: true });
  await upsertProd({ sku: 'PT-JUGOPIÑA',  nombre: 'Jugo de Piña 500ml',        id_categoria: catBebidas.id, tipo_materia: 'procesada', unidad_medida: 'unidad', precio_unitario: 0, precio_venta: 6900,  stock_actual: 0, stock_minimo: 0,  es_vendible: true });

  // ── Menú Infantil ─────────────────────────────────────────────────────────
  await upsertProd({ sku: 'PT-MENUINF',   nombre: 'Menú Infantil',             id_categoria: catMenuInf.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 24000, stock_actual: 0, stock_minimo: 0, es_vendible: true, descripcion: 'Chicken tenders, papas de la casa, jugo en caja, chocolatina y sorpresa' });

  // ── Adiciones ─────────────────────────────────────────────────────────────
  await upsertProd({ sku: 'PT-ADCARNE',   nombre: 'Adición: Carne de Hamburguesa',              id_categoria: catAdiciones.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 8000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-ADTOCINO',  nombre: 'Adición: Tocino',                            id_categoria: catAdiciones.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 4000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-ADPEPINI',  nombre: 'Adición: Pepinillos',                        id_categoria: catAdiciones.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 3000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-ADTOMATE',  nombre: 'Adición: Tomate en Reducción de Limonaria',  id_categoria: catAdiciones.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 3000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-ADCEBOLLA', nombre: 'Adición: Cebolla Caramelizada en Vino Tinto',id_categoria: catAdiciones.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 3000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-ADMANZANA', nombre: 'Adición: Manzana Verde Caramelizada',        id_categoria: catAdiciones.id, tipo_materia: 'procesada', unidad_medida: 'porcion', precio_unitario: 0, precio_venta: 3000, stock_actual: 0, stock_minimo: 0, es_vendible: true });
  await upsertProd({ sku: 'PT-ADHCODO',   nombre: 'Adición: Huevos de Codorniz (Unidad)',       id_categoria: catAdiciones.id, tipo_materia: 'procesada', unidad_medida: 'unidad',  precio_unitario: 0, precio_venta: 1000, stock_actual: 0, stock_minimo: 0, es_vendible: true });

  console.log('✅ 117 productos terminados creados\n');

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN
  // ══════════════════════════════════════════════════════════════════════════
  const totales = await Promise.all([
    prisma.categoria.count(),
    prisma.producto.count({ where: { tipo_materia: 'prima',     es_vendible: false } }),
    prisma.producto.count({ where: { tipo_materia: 'procesada', es_vendible: false } }),
    prisma.producto.count({ where: { es_vendible: true } }),
  ]);

  console.log('✨ ¡Seed Vylonia completado!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📁 Categorías en BD:              ${totales[0]}`);
  console.log(`🧂 Materias Primas:               ${totales[1]}`);
  console.log(`🍳 Materias Primas Procesadas:    ${totales[2]}`);
  console.log(`🍔 Productos Terminados/Vendibles: ${totales[3]}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 Stock actual de terminados = 0 (se calcula desde recetas)');
  console.log('💡 Precio unitario de procesadas = 0 (se calcula desde recetas)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('❌ Error en seed Vylonia:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
