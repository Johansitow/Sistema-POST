/**
 * Seed Recetas — Vylonia Burgers 2026
 *
 * Crea recetas completas para todos los productos terminados y
 * materias primas procesadas del menú.
 *
 * Seguro para re-ejecutar: usa upsert por id_producto_final.
 * Ejecutar: npm run seed:recetas
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna el producto por SKU o lanza error */
async function p(sku: string) {
  const prod = await prisma.producto.findUnique({ where: { sku } });
  if (!prod) throw new Error(`❌ Producto no encontrado: ${sku}`);
  return prod;
}

type Ing = {
  id_producto: number;
  cantidad: number;
  unidad: string;
  es_opcional?: boolean;
  notas?: string;
  numero_fase?: number;
};

type Fase = {
  numero_fase: number;
  nombre: string;
  descripcion: string;
  duracion_minutos?: number;
  merma_esperada_porcentaje?: number;
};

type RecetaOpts = {
  descripcion?: string;
  cantidad_producida?: number;
  unidad_produccion?: string;
  tiempo_preparacion?: number;
  instrucciones_almacenamiento?: string;
  merma_esperada_porcentaje?: number;
};

/** Crea o sobreescribe una receta por producto final */
async function upsertReceta(
  sku_producto: string,
  nombre_receta: string,
  ingredientes: Ing[],
  fases: Fase[],
  opts: RecetaOpts = {}
) {
  const producto = await p(sku_producto);

  const existing = await prisma.receta.findFirst({
    where: { id_producto_final: producto.id },
  });

  const data = {
    nombre_receta,
    descripcion:                  opts.descripcion,
    cantidad_producida:           opts.cantidad_producida ?? 1,
    unidad_produccion:            (opts.unidad_produccion ?? 'porcion') as any,
    tiempo_preparacion:           opts.tiempo_preparacion,
    instrucciones_almacenamiento: opts.instrucciones_almacenamiento,
    merma_esperada_porcentaje:    opts.merma_esperada_porcentaje,
    instrucciones: fases.map(f => `Fase ${f.numero_fase} - ${f.nombre}: ${f.descripcion}`).join('\n\n'),
  };

  let id_receta: number;

  if (existing) {
    await prisma.recetaIngrediente.deleteMany({ where: { id_receta: existing.id } });
    await prisma.recetaFase.deleteMany({ where: { id_receta: existing.id } });
    await prisma.receta.update({ where: { id: existing.id }, data });
    id_receta = existing.id;
  } else {
    const receta = await prisma.receta.create({
      data: { ...data, id_producto_final: producto.id },
    });
    id_receta = receta.id;
  }

  // Fases
  for (const fase of fases) {
    await prisma.recetaFase.create({
      data: {
        id_receta,
        numero_fase:               fase.numero_fase,
        nombre:                    fase.nombre,
        descripcion:               fase.descripcion,
        duracion_minutos:          fase.duracion_minutos,
        merma_esperada_porcentaje: fase.merma_esperada_porcentaje,
      },
    });
  }

  // Ingredientes
  await prisma.recetaIngrediente.createMany({
    data: ingredientes.map((ing, idx) => ({
      id_receta,
      id_producto: ing.id_producto,
      cantidad:    ing.cantidad,
      unidad:      ing.unidad as any,
      es_opcional: ing.es_opcional ?? false,
      notas:       ing.notas,
      orden:       idx,
      numero_fase: ing.numero_fase ?? 1,
    })),
  });

  console.log(`  ✅ ${nombre_receta}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed Recetas Vylonia Burgers — iniciando...\n');

  // ── Cargar todos los productos necesarios ─────────────────────────────────
  console.log('📦 Cargando productos...');

  // Materias primas
  const [
    CHEDDAR, MOZARELL, QCREMA, QBUFALA, BURRATA, CREMALE, LECHEENT,
    CHORIZO, TOCINETA, PANCETA, PEPPERONI, PROSCIUT, PECHUGA, CARNEREZ,
    TOMATE, TOMCHERRY, TOMSMANZ, CEBOLLA, CEBOLLIN, CHAMPINON,
    PAPA, AJO, AREPA, PANKO, PLATMAD, PIÑA, FRESA, MANGO, MORA,
    MARACUYA, GUANABAN, MANDARIN, NARANJA, MANZANAV, LIMON,
    CANPOL, AZUPOL, PANELA, MIEL, NUTELLA, AREQUIP,
    HUEVO, HCODORNI, ACEITE, ACTRUF, VINO, VINAGRE, SOJA, SIRACHA,
    SALMUERA, MAIZENA, MAIZTI, CANAST, PEPINILLO,
  ] = await Promise.all([
    p('MP-CHEDDAR'), p('MP-MOZARELL'), p('MP-QCREMA'), p('MP-QBUFALA'), p('MP-BURRATA'),
    p('MP-CREMALE'), p('MP-LECHEENT'), p('MP-CHORIZO'), p('MP-TOCINETA'), p('MP-PANCETA'),
    p('MP-PEPPERONI'), p('MP-PROSCIUT'), p('MP-PECHUGA'), p('MP-CARNEREZ'), p('MP-TOMATE'), p('MP-TOMCHERRY'),
    p('MP-TOMSMANZ'), p('MP-CEBOLLA'), p('MP-CEBOLLIN'), p('MP-CHAMPINON'), p('MP-PAPA'), p('MP-AJO'),
    p('MP-AREPA'), p('MP-PANKO'), p('MP-PLATMAD'), p('MP-PIÑA'), p('MP-FRESA'),
    p('MP-MANGO'), p('MP-MORA'), p('MP-MARACUYA'), p('MP-GUANABAN'), p('MP-MANDARIN'),
    p('MP-NARANJA'), p('MP-MANZANAV'), p('MP-LIMON'), p('MP-CANPOL'), p('MP-AZUPOL'),
    p('MP-PANELA'), p('MP-MIEL'), p('MP-NUTELLA'), p('MP-AREQUIP'), p('MP-HUEVO'),
    p('MP-HCODORNI'), p('MP-ACEITE'), p('MP-ACTRUF'), p('MP-VINO'), p('MP-VINAGRE'),
    p('MP-SOJA'), p('MP-SIRACHA'), p('MP-SALMUERA'), p('MP-MAIZENA'), p('MP-MAIZTI'),
    p('MP-CANAST'), p('MP-PEPINILLO'),
  ]);

  // Materias primas procesadas
  const [
    SALCASA, SALNAP, PASTAAJO, CREMCEBOL, CEBCARAMEL, MANZVINO,
    PIÑACAR, REDBALS, SALPESTO, SALQUESO, MIELSIR, SALEMI,
    CARNDES, TOCARTESA, PAPASCASA, MASAPIZ, HCODO, TOMLIMON,
    PULPMORA, PULPMAN, PULPMAR, PULPGUA, PULPFRE, PULPPIÑA, PULPMANDR, PULPNAR,
  ] = await Promise.all([
    p('MPP-SALCASA'), p('MPP-SALNAP'), p('MPP-PASTAAJO'), p('MPP-CREMCEBOL'),
    p('MPP-CEBCARAMEL'), p('MPP-MANZVINO'), p('MPP-PIÑACAR'), p('MPP-REDBALS'),
    p('MPP-SALPESTO'), p('MPP-SALQUESO'), p('MPP-MIELSIR'), p('MPP-SALEMI'),
    p('MPP-CARNDES'), p('MPP-TOCARTESA'), p('MPP-PAPASCASA'), p('MPP-MASAPIZ'),
    p('MPP-HCODO'), p('MPP-TOMLIMON'),
    p('MPP-PULPMORA'), p('MPP-PULPMAN'), p('MPP-PULPMAR'), p('MPP-PULPGUA'),
    p('MPP-PULPFRE'), p('MPP-PULPPIÑA'), p('MPP-PULPMANDR'), p('MPP-PULPNAR'),
  ]);

  console.log('✅ Productos cargados\n');

  // ══════════════════════════════════════════════════════════════════════════
  // MATERIAS PRIMAS PROCESADAS (Elaboradas en cocina)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🍳 Creando recetas de Materias Primas Procesadas...');

  await upsertReceta('MPP-SALCASA', 'Salsa de la Casa',
    [
      { id_producto: QCREMA.id,   cantidad: 0.20, unidad: 'kilogramo' },
      { id_producto: AJO.id,      cantidad: 0.02, unidad: 'kilogramo' },
      { id_producto: CEBOLLA.id,  cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: CREMALE.id,  cantidad: 0.10, unidad: 'litro' },
      { id_producto: VINAGRE.id,  cantidad: 0.02, unidad: 'litro' },
      { id_producto: SIRACHA.id,  cantidad: 0.02, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Mezclar todos los ingredientes, procesar en licuadora y refrigerar.', duracion_minutos: 15 }],
    { cantidad_producida: 0.5, unidad_produccion: 'litro', instrucciones_almacenamiento: 'Refrigerado hasta 5 días' }
  );

  await upsertReceta('MPP-SALNAP', 'Salsa Napolitana',
    [
      { id_producto: TOMATE.id,   cantidad: 0.50, unidad: 'kilogramo' },
      { id_producto: AJO.id,      cantidad: 0.02, unidad: 'kilogramo' },
      { id_producto: CEBOLLA.id,  cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,   cantidad: 0.03, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Cocción', descripcion: 'Sofreír ajo y cebolla, agregar tomate, cocinar 20 min a fuego bajo.', duracion_minutos: 25 }],
    { cantidad_producida: 0.5, unidad_produccion: 'litro' }
  );

  await upsertReceta('MPP-PASTAAJO', 'Pasta de Ajo',
    [
      { id_producto: AJO.id,      cantidad: 0.08, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,   cantidad: 0.02, unidad: 'litro' },
      { id_producto: CREMALE.id,  cantidad: 0.02, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Procesado', descripcion: 'Procesar ajo con aceite y crema hasta obtener pasta homogénea.', duracion_minutos: 10 }],
    { cantidad_producida: 100, unidad_produccion: 'gramo' }
  );

  await upsertReceta('MPP-CREMCEBOL', 'Crema Cebollín',
    [
      { id_producto: QCREMA.id,   cantidad: 0.20, unidad: 'kilogramo' },
      { id_producto: CEBOLLIN.id, cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: CREMALE.id,  cantidad: 0.10, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Mezclar queso crema con cebollín picado y crema de leche.', duracion_minutos: 10 }],
    { cantidad_producida: 0.3, unidad_produccion: 'litro', instrucciones_almacenamiento: 'Refrigerado hasta 3 días' }
  );

  await upsertReceta('MPP-CEBCARAMEL', 'Cebolla Caramelizada',
    [
      { id_producto: CEBOLLA.id,  cantidad: 0.60, unidad: 'kilogramo' },
      { id_producto: VINO.id,     cantidad: 0.10, unidad: 'litro' },
      { id_producto: PANELA.id,   cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,   cantidad: 0.02, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Caramelización', descripcion: 'Cocinar cebolla con aceite y panela a fuego bajo 40 min, añadir vino y reducir.', duracion_minutos: 45, merma_esperada_porcentaje: 40 }],
    { cantidad_producida: 0.5, unidad_produccion: 'kilogramo', merma_esperada_porcentaje: 40 }
  );

  await upsertReceta('MPP-MANZVINO', 'Manzana Reducida con Vino',
    [
      { id_producto: MANZANAV.id, cantidad: 0.60, unidad: 'kilogramo' },
      { id_producto: VINO.id,     cantidad: 0.10, unidad: 'litro' },
      { id_producto: PANELA.id,   cantidad: 0.05, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Reducción', descripcion: 'Cortar manzana, cocinar con vino y panela hasta caramelizar.', duracion_minutos: 20 }],
    { cantidad_producida: 0.5, unidad_produccion: 'kilogramo' }
  );

  await upsertReceta('MPP-PIÑACAR', 'Piña Caramelizada',
    [
      { id_producto: PIÑA.id,     cantidad: 0.60, unidad: 'kilogramo' },
      { id_producto: PANELA.id,   cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,   cantidad: 0.01, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Caramelización', descripcion: 'Cortar piña, cocinar en sartén con panela hasta dorar.', duracion_minutos: 15 }],
    { cantidad_producida: 0.5, unidad_produccion: 'kilogramo' }
  );

  await upsertReceta('MPP-REDBALS', 'Reducción Balsámica',
    [
      { id_producto: VINAGRE.id,  cantidad: 0.30, unidad: 'litro' },
      { id_producto: PANELA.id,   cantidad: 0.05, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Reducción', descripcion: 'Hervir vinagre con panela a fuego medio hasta reducir a la mitad.', duracion_minutos: 20, merma_esperada_porcentaje: 50 }],
    { cantidad_producida: 0.3, unidad_produccion: 'litro', merma_esperada_porcentaje: 50 }
  );

  await upsertReceta('MPP-SALPESTO', 'Salsa Pesto',
    [
      { id_producto: AJO.id,      cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,   cantidad: 0.10, unidad: 'litro' },
      { id_producto: QCREMA.id,   cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: CEBOLLIN.id, cantidad: 0.05, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Procesado', descripcion: 'Licuar todos los ingredientes hasta obtener salsa homogénea.', duracion_minutos: 10 }],
    { cantidad_producida: 0.3, unidad_produccion: 'litro' }
  );

  await upsertReceta('MPP-SALQUESO', 'Salsa Queso de la Casa',
    [
      { id_producto: CHEDDAR.id,   cantidad: 0.15, unidad: 'kilogramo' },
      { id_producto: CREMALE.id,   cantidad: 0.10, unidad: 'litro' },
      { id_producto: LECHEENT.id,  cantidad: 0.10, unidad: 'litro' },
      { id_producto: MAIZENA.id,   cantidad: 0.01, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Cocción', descripcion: 'Fundir cheddar con crema y leche, espesar con maicena a fuego bajo.', duracion_minutos: 15 }],
    { cantidad_producida: 0.3, unidad_produccion: 'litro' }
  );

  await upsertReceta('MPP-MIELSIR', 'Miel de Sriracha',
    [
      { id_producto: MIEL.id,     cantidad: 0.15, unidad: 'litro' },
      { id_producto: SIRACHA.id,  cantidad: 0.15, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Mezcla', descripcion: 'Combinar miel y sriracha, remover hasta homogeneizar.', duracion_minutos: 5 }],
    { cantidad_producida: 0.3, unidad_produccion: 'litro' }
  );

  await upsertReceta('MPP-SALEMI', 'Salsa Emi',
    [
      { id_producto: QCREMA.id,   cantidad: 0.20, unidad: 'kilogramo' },
      { id_producto: SIRACHA.id,  cantidad: 0.03, unidad: 'litro' },
      { id_producto: CEBOLLA.id,  cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,   cantidad: 0.02, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Mezclar queso crema con sriracha, cebolla picada y aceite.', duracion_minutos: 10 }],
    { cantidad_producida: 0.3, unidad_produccion: 'litro' }
  );

  await upsertReceta('MPP-CARNDES', 'Carne Desmechada',
    [
      { id_producto: PECHUGA.id,  cantidad: 1.20, unidad: 'kilogramo' },
      { id_producto: CEBOLLA.id,  cantidad: 0.10, unidad: 'kilogramo' },
      { id_producto: AJO.id,      cantidad: 0.02, unidad: 'kilogramo' },
      { id_producto: SOJA.id,     cantidad: 0.05, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Cocción', descripcion: 'Cocinar pechuga con ajo, cebolla y soja hasta tierna.', duracion_minutos: 35 },
      { numero_fase: 2, nombre: 'Desmechado', descripcion: 'Desmechar la carne y reservar en el guiso.', duracion_minutos: 10 },
    ],
    { cantidad_producida: 1, unidad_produccion: 'kilogramo', merma_esperada_porcentaje: 20, instrucciones_almacenamiento: 'Refrigerado hasta 3 días' }
  );

  await upsertReceta('MPP-TOCARTESA', 'Tocineta Artesanal de la Casa',
    [
      { id_producto: PANCETA.id,  cantidad: 0.60, unidad: 'kilogramo' },
      { id_producto: SOJA.id,     cantidad: 0.05, unidad: 'litro' },
      { id_producto: PANELA.id,   cantidad: 0.03, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Curado y cocción', descripcion: 'Marinar panceta en soja y panela, hornear a 180°C por 25 min.', duracion_minutos: 30 }],
    { cantidad_producida: 0.5, unidad_produccion: 'kilogramo', merma_esperada_porcentaje: 15, instrucciones_almacenamiento: 'Refrigerado hasta 4 días' }
  );

  await upsertReceta('MPP-PAPASCASA', 'Papas de la Casa',
    [
      { id_producto: PAPA.id,      cantidad: 0.70, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,    cantidad: 0.05, unidad: 'litro' },
      { id_producto: SALMUERA.id,  cantidad: 0.02, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Preparación', descripcion: 'Lavar y cortar papa en cascos. Salar y dejar reposar 10 min.', duracion_minutos: 10 },
      { numero_fase: 2, nombre: 'Fritura', descripcion: 'Freír en aceite caliente hasta dorar. Escurrir y salar al gusto.', duracion_minutos: 15, merma_esperada_porcentaje: 10 },
    ],
    { cantidad_producida: 1, unidad_produccion: 'porcion', merma_esperada_porcentaje: 10 }
  );

  await upsertReceta('MPP-MASAPIZ', 'Masa para Pizza de la Casa',
    [
      { id_producto: MAIZENA.id,   cantidad: 0.20, unidad: 'kilogramo' },
      { id_producto: LECHEENT.id,  cantidad: 0.15, unidad: 'litro' },
      { id_producto: ACEITE.id,    cantidad: 0.02, unidad: 'litro' },
      { id_producto: HUEVO.id,     cantidad: 1,    unidad: 'unidad' },
    ],
    [{ numero_fase: 1, nombre: 'Amasado', descripcion: 'Mezclar ingredientes, amasar 10 min hasta obtener masa suave. Reposar 20 min.', duracion_minutos: 30 }],
    { cantidad_producida: 400, unidad_produccion: 'gramo', descripcion: 'Masa base para pizza personal (400g rinde 1 pizza personal)' }
  );

  await upsertReceta('MPP-HCODO', 'Huevos de Codorniz Cocidos',
    [
      { id_producto: HCODORNI.id,  cantidad: 12, unidad: 'unidad' },
      { id_producto: SALMUERA.id,  cantidad: 0.10, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Cocción', descripcion: 'Hervir huevos en salmuera 5 min, enfriar y pelar.', duracion_minutos: 15 }],
    { cantidad_producida: 10, unidad_produccion: 'unidad', instrucciones_almacenamiento: 'Refrigerado hasta 3 días' }
  );

  await upsertReceta('MPP-TOMLIMON', 'Tomate en Reducción de Limonaria',
    [
      { id_producto: TOMATE.id, cantidad: 0.50, unidad: 'kilogramo', notas: 'Tomate maduro, corte en rodajas medianas' },
      { id_producto: LIMON.id,  cantidad: 0.06, unidad: 'kilogramo', notas: 'Jugo de limón (simula reducción de limonaria)' },
      { id_producto: ACEITE.id, cantidad: 0.01, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Corte', descripcion: 'Lavar y cortar el tomate en rodajas de 8 mm de grosor.', duracion_minutos: 5 },
      { numero_fase: 2, nombre: 'Marinado', descripcion: 'Bañar las rodajas con jugo de limón, aceite y sal. Dejar reposar 10 min en frío.', duracion_minutos: 10, merma_esperada_porcentaje: 8 },
    ],
    { cantidad_producida: 0.45, unidad_produccion: 'kilogramo', merma_esperada_porcentaje: 8, instrucciones_almacenamiento: 'Refrigerado hasta 2 días, tapado' }
  );

  // ── Pulpas ─────────────────────────────────────────────────────────────────

  const pulpas: [string, string, { id_producto: number }][] = [
    ['MPP-PULPMORA',  'Pulpa de Mora',        { id_producto: MORA.id }],
    ['MPP-PULPMAN',   'Pulpa de Mango',        { id_producto: MANGO.id }],
    ['MPP-PULPMAR',   'Pulpa de Maracuyá',     { id_producto: MARACUYA.id }],
    ['MPP-PULPGUA',   'Pulpa de Guanábana',    { id_producto: GUANABAN.id }],
    ['MPP-PULPFRE',   'Pulpa de Fresa',        { id_producto: FRESA.id }],
    ['MPP-PULPPIÑA',  'Pulpa de Piña',         { id_producto: PIÑA.id }],
    ['MPP-PULPMANDR', 'Pulpa de Mandarina',    { id_producto: MANDARIN.id }],
    ['MPP-PULPNAR',   'Pulpa de Naranja',      { id_producto: NARANJA.id }],
  ];

  for (const [sku, nombre, fruta] of pulpas) {
    await upsertReceta(sku, nombre,
      [
        { ...fruta, cantidad: 0.45, unidad: 'kilogramo' },
        { id_producto: AZUPOL.id, cantidad: 0.04, unidad: 'kilogramo' },
      ],
      [{ numero_fase: 1, nombre: 'Procesado', descripcion: 'Licuar fruta con azúcar, colar y refrigerar.', duracion_minutos: 10 }],
      { cantidad_producida: 0.5, unidad_produccion: 'litro', merma_esperada_porcentaje: 10, instrucciones_almacenamiento: 'Refrigerado hasta 3 días' }
    );
  }

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // ENTRADAS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🥟 Creando recetas de Entradas...');

  await upsertReceta('PT-ARECHOR', 'Arepa con Chorizo',
    [
      { id_producto: AREPA.id,    cantidad: 1,    unidad: 'unidad' },
      { id_producto: CHORIZO.id,  cantidad: 0.10, unidad: 'kilogramo' },
      { id_producto: SALNAP.id,   cantidad: 0.04, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Asar la arepa, cocinar chorizo en rodajas y servir con napolitana.', duracion_minutos: 10 }],
    { tiempo_preparacion: 10, merma_esperada_porcentaje: 3 }
  );

  await upsertReceta('PT-ARERELL', 'Arepa Rellena de Chorizo',
    [
      { id_producto: AREPA.id,    cantidad: 1,    unidad: 'unidad' },
      { id_producto: CHORIZO.id,  cantidad: 0.10, unidad: 'kilogramo' },
      { id_producto: MOZARELL.id, cantidad: 0.08, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Asar arepa, abrir por la mitad, rellenar con chorizo y mozzarella, gratinar.', duracion_minutos: 12 }],
    { tiempo_preparacion: 12, merma_esperada_porcentaje: 3 }
  );

  await upsertReceta('PT-ARECARNE', 'Arepa con Carne Mechada',
    [
      { id_producto: AREPA.id,    cantidad: 1,    unidad: 'unidad' },
      { id_producto: CARNDES.id,  cantidad: 0.10, unidad: 'kilogramo' },
      { id_producto: MOZARELL.id, cantidad: 0.08, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Asar arepa, rellenar con carne desmechada y mozzarella fundida.', duracion_minutos: 10 }],
    { tiempo_preparacion: 10 }
  );

  await upsertReceta('PT-CEVCHOR', 'Ceviche de Chorizo',
    [
      { id_producto: CHORIZO.id,  cantidad: 0.12, unidad: 'kilogramo' },
      { id_producto: TOMATE.id,   cantidad: 0.10, unidad: 'kilogramo' },
      { id_producto: CEBOLLA.id,  cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: LIMON.id,    cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: CEBOLLIN.id, cantidad: 0.02, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Cortar chorizo, mezclar con tomate, cebolla y jugo de limón. Reposar 5 min.', duracion_minutos: 10 }],
    { tiempo_preparacion: 10 }
  );

  await upsertReceta('PT-DEDQUESO', 'Deditos de Queso',
    [
      { id_producto: MOZARELL.id, cantidad: 0.15, unidad: 'kilogramo' },
      { id_producto: PANKO.id,    cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: HUEVO.id,    cantidad: 2,    unidad: 'unidad' },
      { id_producto: ACEITE.id,   cantidad: 0.10, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Empanizado', descripcion: 'Cortar mozzarella en tiras, pasar por huevo batido y panko.', duracion_minutos: 10 },
      { numero_fase: 2, nombre: 'Fritura',    descripcion: 'Freír en aceite caliente hasta dorar. Escurrir.', duracion_minutos: 5 },
    ],
    { tiempo_preparacion: 15, merma_esperada_porcentaje: 5 }
  );

  await upsertReceta('PT-CHTEND', 'Chicken Tenders',
    [
      { id_producto: PECHUGA.id,  cantidad: 0.15, unidad: 'kilogramo' },
      { id_producto: PANKO.id,    cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: HUEVO.id,    cantidad: 1,    unidad: 'unidad' },
      { id_producto: ACEITE.id,   cantidad: 0.10, unidad: 'litro' },
      { id_producto: MIELSIR.id,  cantidad: 0.03, unidad: 'litro', es_opcional: true },
    ],
    [
      { numero_fase: 1, nombre: 'Empanizado', descripcion: 'Cortar pechuga en tiras, salpimentar, pasar por huevo y panko.', duracion_minutos: 10 },
      { numero_fase: 2, nombre: 'Fritura',    descripcion: 'Freír en aceite 180°C hasta dorar. Servir con miel sriracha.', duracion_minutos: 8 },
    ],
    { tiempo_preparacion: 18, merma_esperada_porcentaje: 5 }
  );

  await upsertReceta('PT-PLATCHOR', 'Plátano Maduro con Chorizo',
    [
      { id_producto: PLATMAD.id,  cantidad: 1,    unidad: 'unidad' },
      { id_producto: CHORIZO.id,  cantidad: 0.08, unidad: 'kilogramo' },
      { id_producto: MOZARELL.id, cantidad: 0.06, unidad: 'kilogramo' },
    ],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Freír plátano, disponer chorizo en rodajas y mozzarella. Gratinar.', duracion_minutos: 12 }],
    { tiempo_preparacion: 12 }
  );

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // HAMBURGUESAS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🍔 Creando recetas de Hamburguesas...');

  // Base para hamburguesas de CARNE DE RES (Mística, Maléfica, Medusa, Úrsula, Cruella, Nebula)
  const baseHmbRes = () => [
    { id_producto: CANAST.id,    cantidad: 1,    unidad: 'unidad',     notas: 'Pan brioche de papa recién horneado' },
    { id_producto: CARNEREZ.id,  cantidad: 0.16, unidad: 'kilogramo',  notas: 'Carne de res 100% premium, medallón de 150g' },
    { id_producto: PASTAAJO.id,  cantidad: 0.02, unidad: 'kilogramo',  notas: 'Untada en ambas tapas del pan' },
    { id_producto: TOMLIMON.id,  cantidad: 0.05, unidad: 'kilogramo',  notas: 'Tomate en reducción de limonaria' },
  ];

  // Base para hamburguesa de POLLO (Viuda Negra)
  const baseHmbPollo = () => [
    { id_producto: CANAST.id,    cantidad: 1,    unidad: 'unidad',     notas: 'Pan brioche de papa recién horneado' },
    { id_producto: PECHUGA.id,   cantidad: 0.17, unidad: 'kilogramo',  notas: 'Pechuga de pollo apanada 150g' },
    { id_producto: PANKO.id,     cantidad: 0.04, unidad: 'kilogramo',  notas: 'Para apanado de la pechuga' },
    { id_producto: HUEVO.id,     cantidad: 1,    unidad: 'unidad',     notas: 'Ligante para apanado' },
    { id_producto: PASTAAJO.id,  cantidad: 0.02, unidad: 'kilogramo',  notas: 'Untada en ambas tapas del pan' },
    { id_producto: TOMLIMON.id,  cantidad: 0.05, unidad: 'kilogramo',  notas: 'Tomate en reducción de limonaria' },
  ];

  // ── Mística ───────────────────────────────────────────────────────────────
  // Pan brioche papa | queso cheddar | 150g carne res | cebolla caramelizada
  // tomate reducción limonaria | pepinillos | tocineta | salsa de la casa
  await upsertReceta('PT-HMBMIST', 'Mística',
    [
      ...baseHmbRes(),
      { id_producto: CHEDDAR.id,    cantidad: 0.05, unidad: 'kilogramo', notas: 'Fundido sobre la carne' },
      { id_producto: CEBCARAMEL.id, cantidad: 0.04, unidad: 'kilogramo' },
      { id_producto: PEPINILLO.id,  cantidad: 0.02, unidad: 'kilogramo' },
      { id_producto: TOCARTESA.id,  cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: SALCASA.id,    cantidad: 0.03, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Cocción carne', descripcion: 'Sazonar medallón de res con sal y pimienta. Sellar en plancha caliente 3-4 min por lado hasta punto deseado. Fundir cheddar encima al final.', duracion_minutos: 8, merma_esperada_porcentaje: 12 },
      { numero_fase: 2, nombre: 'Armado',        descripcion: 'Untar pasta de ajo en ambas tapas del pan. Colocar carne con cheddar, cebolla caramelizada, tomate en reducción de limonaria, pepinillos, tocineta artesanal y salsa de la casa.', duracion_minutos: 3 },
    ],
    { tiempo_preparacion: 12, merma_esperada_porcentaje: 8, descripcion: 'Hamburguesa clásica: carne de res, cheddar, cebolla caramelizada, pepinillos, tocineta y salsa de la casa' }
  );

  // ── Maléfica ──────────────────────────────────────────────────────────────
  // Pan brioche | queso cheddar | 150g carne res | tocineta | manzana verde
  // caramelizada | cebolla caramelizada | tomate reducción limonaria | salsa de la casa
  await upsertReceta('PT-HMBMAL', 'Maléfica',
    [
      ...baseHmbRes(),
      { id_producto: CHEDDAR.id,    cantidad: 0.05, unidad: 'kilogramo', notas: 'Fundido sobre la carne' },
      { id_producto: TOCARTESA.id,  cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: MANZVINO.id,   cantidad: 0.04, unidad: 'kilogramo', notas: 'Manzana verde caramelizada' },
      { id_producto: CEBCARAMEL.id, cantidad: 0.04, unidad: 'kilogramo' },
      { id_producto: SALCASA.id,    cantidad: 0.03, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Cocción carne', descripcion: 'Sellar medallón de res 3-4 min por lado. Fundir cheddar encima.', duracion_minutos: 8, merma_esperada_porcentaje: 12 },
      { numero_fase: 2, nombre: 'Armado',        descripcion: 'Pasta de ajo en el pan. Carne con cheddar, tocineta, manzana caramelizada al vino, cebolla caramelizada, tomate reducción limonaria y salsa de la casa.', duracion_minutos: 3 },
    ],
    { tiempo_preparacion: 12, merma_esperada_porcentaje: 8, descripcion: 'Hamburguesa de res con manzana verde caramelizada, tocineta y cebolla' }
  );

  // ── Viuda Negra ───────────────────────────────────────────────────────────
  // Pan brioche papa | queso cheddar | 150g pechuga apanada | cebolla
  // caramelizada | tomate reducción limonaria | tocineta | salsa de la casa
  await upsertReceta('PT-HMBVIU', 'Viuda Negra',
    [
      ...baseHmbPollo(),
      { id_producto: CHEDDAR.id,    cantidad: 0.05, unidad: 'kilogramo', notas: 'Fundido sobre la pechuga' },
      { id_producto: CEBCARAMEL.id, cantidad: 0.04, unidad: 'kilogramo' },
      { id_producto: TOCARTESA.id,  cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: SALCASA.id,    cantidad: 0.03, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Apanado pechuga', descripcion: 'Aplanar pechuga, pasar por huevo batido y panko. Freír en aceite 180°C por 5-6 min por lado hasta dorar.', duracion_minutos: 14, merma_esperada_porcentaje: 8 },
      { numero_fase: 2, nombre: 'Armado',           descripcion: 'Pasta de ajo en el pan. Colocar pechuga apanada, cheddar fundido, cebolla caramelizada, tomate reducción limonaria, tocineta y salsa de la casa.', duracion_minutos: 3 },
    ],
    { tiempo_preparacion: 18, merma_esperada_porcentaje: 6, descripcion: 'Hamburguesa de pechuga apanada con cheddar, tocineta y cebolla caramelizada' }
  );

  // ── Medusa ────────────────────────────────────────────────────────────────
  // Pan brioche papa | queso cheddar | 150g carne res cubierta en tocineta
  // crujiente | cebolla caramelizada | tomate reducción limonaria | salsa de la casa
  await upsertReceta('PT-HMBMED', 'Medusa',
    [
      ...baseHmbRes(),
      { id_producto: CHEDDAR.id,    cantidad: 0.05, unidad: 'kilogramo', notas: 'Fundido sobre la carne' },
      { id_producto: TOCARTESA.id,  cantidad: 0.05, unidad: 'kilogramo', notas: 'Tiras crujientes que cubren la carne' },
      { id_producto: CEBCARAMEL.id, cantidad: 0.04, unidad: 'kilogramo' },
      { id_producto: SALCASA.id,    cantidad: 0.03, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Cocción carne y tocineta', descripcion: 'Sellar medallón de res 3-4 min por lado. Crispear tiras de tocineta hasta quedar crujientes. Cubrir la carne con las tiras de tocineta y fundir cheddar encima.', duracion_minutos: 12, merma_esperada_porcentaje: 12 },
      { numero_fase: 2, nombre: 'Armado',                   descripcion: 'Pasta de ajo en el pan. Carne cubierta en tocineta con cheddar, cebolla caramelizada, tomate reducción limonaria y salsa de la casa.', duracion_minutos: 3 },
    ],
    { tiempo_preparacion: 16, merma_esperada_porcentaje: 8, descripcion: 'Hamburguesa de res cubierta en tiras de tocineta crujiente y cheddar fundido' }
  );

  // ── Úrsula ────────────────────────────────────────────────────────────────
  // Pan brioche papa | 150g carne res | mezcla queso crema cebollín y tocineta
  // | pepinillos | tomate reducción limonaria | salsa de la casa
  await upsertReceta('PT-HMBURS', 'Úrsula',
    [
      ...baseHmbRes(),
      { id_producto: CREMCEBOL.id,  cantidad: 0.05, unidad: 'kilogramo', notas: 'Crema de queso crema con cebollín y tocineta' },
      { id_producto: TOCARTESA.id,  cantidad: 0.03, unidad: 'kilogramo', notas: 'Mezclada en la crema de cebollín' },
      { id_producto: PEPINILLO.id,  cantidad: 0.02, unidad: 'kilogramo' },
      { id_producto: SALCASA.id,    cantidad: 0.03, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Cocción carne', descripcion: 'Sellar medallón de res 3-4 min por lado al punto deseado.', duracion_minutos: 8, merma_esperada_porcentaje: 12 },
      { numero_fase: 2, nombre: 'Armado',        descripcion: 'Untar crema cebollín-tocineta en la tapa superior. Colocar carne, pepinillos, tomate reducción limonaria y salsa de la casa.', duracion_minutos: 3 },
    ],
    { tiempo_preparacion: 12, merma_esperada_porcentaje: 8, descripcion: 'Hamburguesa de res con crema de queso crema, cebollín y tocineta' }
  );

  // ── Cruella ───────────────────────────────────────────────────────────────
  // Pan brioche papa | doble cheddar | dos carnes res 150g | cebolla
  // caramelizada | tomate reducción limonaria | tocineta | salsa de la casa
  await upsertReceta('PT-HMBCRU', 'Cruella',
    [
      { id_producto: CANAST.id,     cantidad: 1,    unidad: 'unidad',     notas: 'Pan brioche de papa recién horneado' },
      { id_producto: CARNEREZ.id,   cantidad: 0.32, unidad: 'kilogramo',  notas: 'Dos medallones de 150g de carne de res 100% premium' },
      { id_producto: PASTAAJO.id,   cantidad: 0.02, unidad: 'kilogramo',  notas: 'Untada en ambas tapas del pan' },
      { id_producto: TOMLIMON.id,   cantidad: 0.05, unidad: 'kilogramo',  notas: 'Tomate en reducción de limonaria' },
      { id_producto: CHEDDAR.id,    cantidad: 0.10, unidad: 'kilogramo',  notas: 'Doble queso cheddar, una capa por medallón' },
      { id_producto: CEBCARAMEL.id, cantidad: 0.05, unidad: 'kilogramo' },
      { id_producto: TOCARTESA.id,  cantidad: 0.04, unidad: 'kilogramo' },
      { id_producto: SALCASA.id,    cantidad: 0.03, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Cocción doble carne', descripcion: 'Sellar ambos medallones de res 3-4 min por lado. Fundir cheddar sobre cada uno.', duracion_minutos: 10, merma_esperada_porcentaje: 12 },
      { numero_fase: 2, nombre: 'Armado doble',        descripcion: 'Pasta de ajo en el pan. Primer medallón con cheddar, segundo medallón encima con cheddar, cebolla caramelizada, tomate reducción limonaria, tocineta y salsa de la casa.', duracion_minutos: 4 },
    ],
    { tiempo_preparacion: 15, merma_esperada_porcentaje: 8, descripcion: 'Hamburguesa doble: dos medallones de res, doble cheddar, tocineta y cebolla caramelizada' }
  );

  // ── Nebula ────────────────────────────────────────────────────────────────
  // Pan brioche papa | queso cheddar | 150g carne res | cebolla caramelizada
  // tomate reducción limonaria | tocineta | salsa Emi premium
  await upsertReceta('PT-HMBNEB', 'Nebula',
    [
      ...baseHmbRes(),
      { id_producto: CHEDDAR.id,    cantidad: 0.05, unidad: 'kilogramo', notas: 'Fundido sobre la carne' },
      { id_producto: CEBCARAMEL.id, cantidad: 0.04, unidad: 'kilogramo' },
      { id_producto: TOCARTESA.id,  cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: SALEMI.id,     cantidad: 0.03, unidad: 'litro',     notas: 'Salsa Emi premium con nivel de picor tolerable' },
    ],
    [
      { numero_fase: 1, nombre: 'Cocción carne', descripcion: 'Sellar medallón de res 3-4 min por lado. Fundir cheddar encima.', duracion_minutos: 8, merma_esperada_porcentaje: 12 },
      { numero_fase: 2, nombre: 'Armado',        descripcion: 'Pasta de ajo en el pan. Carne con cheddar, cebolla caramelizada, tomate reducción limonaria, tocineta y Salsa Emi premium.', duracion_minutos: 3 },
    ],
    { tiempo_preparacion: 12, merma_esperada_porcentaje: 8, descripcion: 'Hamburguesa de res con Salsa Emi premium de picor tolerable' }
  );

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // PAPAS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🍟 Creando recetas de Papas...');

  await upsertReceta('PT-PAPSEN', 'Papas Sencillas',
    [
      { id_producto: PAPA.id,   cantidad: 0.22, unidad: 'kilogramo' },
      { id_producto: ACEITE.id, cantidad: 0.02, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Fritura', descripcion: 'Cortar papa en bastones, freír en aceite 180°C hasta dorar. Salar.', duracion_minutos: 10 }],
    { tiempo_preparacion: 10, merma_esperada_porcentaje: 8 }
  );

  await upsertReceta('PT-PAPCOMP', 'Papas para Compartir',
    [
      { id_producto: PAPA.id,   cantidad: 0.65, unidad: 'kilogramo' },
      { id_producto: ACEITE.id, cantidad: 0.05, unidad: 'litro' },
    ],
    [{ numero_fase: 1, nombre: 'Fritura', descripcion: 'Cortar papa en bastones. Freír en aceite 180°C. Salar al gusto.', duracion_minutos: 14 }],
    { tiempo_preparacion: 14, merma_esperada_porcentaje: 8, descripcion: 'Porción grande para compartir' }
  );

  await upsertReceta('PT-PAPBRAV', 'Papas Bravas',
    [
      { id_producto: PAPA.id,    cantidad: 0.22, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,  cantidad: 0.02, unidad: 'litro' },
      { id_producto: SALNAP.id,  cantidad: 0.04, unidad: 'litro' },
      { id_producto: MIELSIR.id, cantidad: 0.02, unidad: 'litro' },
    ],
    [
      { numero_fase: 1, nombre: 'Fritura', descripcion: 'Freír papas hasta dorar.', duracion_minutos: 10 },
      { numero_fase: 2, nombre: 'Salsa',   descripcion: 'Bañar con napolitana y miel sriracha al momento de servir.', duracion_minutos: 2 },
    ],
    { tiempo_preparacion: 12, merma_esperada_porcentaje: 8 }
  );

  await upsertReceta('PT-PAPCHED', 'Papas Cheddar Tocino',
    [
      { id_producto: PAPA.id,      cantidad: 0.22, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,    cantidad: 0.02, unidad: 'litro' },
      { id_producto: SALQUESO.id,  cantidad: 0.05, unidad: 'litro' },
      { id_producto: TOCARTESA.id, cantidad: 0.03, unidad: 'kilogramo' },
    ],
    [
      { numero_fase: 1, nombre: 'Fritura',  descripcion: 'Freír papas hasta dorar.', duracion_minutos: 10 },
      { numero_fase: 2, nombre: 'Montaje',  descripcion: 'Bañar con salsa queso caliente y decorar con tocineta artesanal.', duracion_minutos: 2 },
    ],
    { tiempo_preparacion: 12, merma_esperada_porcentaje: 8 }
  );

  await upsertReceta('PT-CHORPAP', 'Chori Papas',
    [
      { id_producto: PAPA.id,     cantidad: 0.22, unidad: 'kilogramo' },
      { id_producto: ACEITE.id,   cantidad: 0.02, unidad: 'litro' },
      { id_producto: CHORIZO.id,  cantidad: 0.08, unidad: 'kilogramo' },
      { id_producto: SALNAP.id,   cantidad: 0.03, unidad: 'litro', es_opcional: true },
    ],
    [
      { numero_fase: 1, nombre: 'Fritura',   descripcion: 'Freír papas. Cocinar chorizo en rodajas.', duracion_minutos: 12 },
      { numero_fase: 2, nombre: 'Montaje',   descripcion: 'Servir papas con chorizo y salsa napolitana opcional.', duracion_minutos: 2 },
    ],
    { tiempo_preparacion: 14, merma_esperada_porcentaje: 8 }
  );

  await upsertReceta('PT-PAPCASA', 'Papas de la Casa',
    [
      { id_producto: PAPASCASA.id, cantidad: 1,    unidad: 'porcion' },
      { id_producto: SALCASA.id,   cantidad: 0.03, unidad: 'litro' },
      { id_producto: CEBOLLIN.id,  cantidad: 0.01, unidad: 'kilogramo', es_opcional: true },
    ],
    [{ numero_fase: 1, nombre: 'Montaje', descripcion: 'Servir papas de la casa con salsa signature y cebollín fresco.', duracion_minutos: 3 }],
    { tiempo_preparacion: 3, descripcion: 'Papas premium con salsa signature de Vylonia' }
  );

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // PIZZAS — Personal / Mediana / Familiar
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🍕 Creando recetas de Pizzas...');

  // Cantidades de masa e ingredientes por tamaño
  const TAMANOS = [
    { sufijo: 'p', sku_sufijo: 'P', masa: 400, salsa: 0.05, queso: 0.08, topping: 0.08, min: 8  },
    { sufijo: 'm', sku_sufijo: 'M', masa: 600, salsa: 0.08, queso: 0.12, topping: 0.12, min: 12 },
    { sufijo: 'f', sku_sufijo: 'F', masa: 900, salsa: 0.12, queso: 0.18, topping: 0.18, min: 18 },
  ];

  type PizzaReceta = {
    base: string;   // sku raíz, ej: 'PT-PIZZPEP'
    nombre: string;
    toppings: (t: typeof TAMANOS[0]) => Ing[];
    descripcion: string;
    salsaBase?: number; // id del producto salsa
  };

  const pizzas: PizzaReceta[] = [
    {
      base: 'PT-PIZZPEP', nombre: 'Pizza de Pepperoni',
      descripcion: 'Clásica pizza napolitana con pepperoni y mozzarella',
      salsaBase: SALNAP.id,
      toppings: t => [
        { id_producto: PEPPERONI.id, cantidad: t.topping, unidad: 'kilogramo' },
        { id_producto: MOZARELL.id,  cantidad: t.queso,   unidad: 'kilogramo' },
      ],
    },
    {
      base: 'PT-PIZZHAW', nombre: 'Pizza Hawaiana',
      descripcion: 'Pizza con pollo, piña caramelizada y mozzarella',
      salsaBase: SALNAP.id,
      toppings: t => [
        { id_producto: PECHUGA.id,  cantidad: t.topping, unidad: 'kilogramo' },
        { id_producto: PIÑACAR.id,  cantidad: t.topping * 0.7, unidad: 'kilogramo' },
        { id_producto: MOZARELL.id, cantidad: t.queso,   unidad: 'kilogramo' },
      ],
    },
    {
      base: 'PT-PIZZSIC', nombre: 'Pizza Siciliana',
      descripcion: 'Pizza napolitana con tomate san manzano, bocconcini di búfala y pepperoni de la casa',
      salsaBase: SALNAP.id,
      toppings: t => [
        { id_producto: TOMSMANZ.id,  cantidad: t.topping * 0.5, unidad: 'kilogramo', notas: 'Tomate san manzano en rodajas' },
        { id_producto: QBUFALA.id,   cantidad: t.queso,         unidad: 'kilogramo', notas: 'Bocconcini di búfala' },
        { id_producto: PEPPERONI.id, cantidad: t.topping * 0.4, unidad: 'kilogramo', notas: 'Pepperoni de mezcla de la casa' },
      ],
    },
    {
      base: 'PT-PIZZPES', nombre: 'Pizza al Pesto',
      descripcion: 'Pizza con salsa pesto, burrata y tomate cherry',
      salsaBase: SALPESTO.id,
      toppings: t => [
        { id_producto: BURRATA.id,   cantidad: t.queso,         unidad: 'kilogramo' },
        { id_producto: TOMCHERRY.id, cantidad: t.topping * 0.5, unidad: 'kilogramo' },
      ],
    },
    {
      base: 'PT-PIZZQCS', nombre: 'Pizza Quesos de la Casa',
      descripcion: 'Pizza cuatro quesos con salsa napolitana',
      salsaBase: SALNAP.id,
      toppings: t => [
        { id_producto: CHEDDAR.id,  cantidad: t.queso * 0.5, unidad: 'kilogramo' },
        { id_producto: MOZARELL.id, cantidad: t.queso * 0.5, unidad: 'kilogramo' },
        { id_producto: QCREMA.id,   cantidad: t.queso * 0.4, unidad: 'kilogramo' },
      ],
    },
    {
      base: 'PT-PIZZCRIO', nombre: 'Pizza Criolla',
      descripcion: 'Pizza con carne desmechada y mozzarella',
      salsaBase: SALNAP.id,
      toppings: t => [
        { id_producto: CARNDES.id,  cantidad: t.topping, unidad: 'kilogramo' },
        { id_producto: MOZARELL.id, cantidad: t.queso,   unidad: 'kilogramo' },
      ],
    },
    {
      base: 'PT-PIZZPCH', nombre: 'Pizza Pollo y Champiñones',
      descripcion: 'Pizza con pollo, champiñones y mozzarella',
      salsaBase: SALNAP.id,
      toppings: t => [
        { id_producto: PECHUGA.id,   cantidad: t.topping * 0.6, unidad: 'kilogramo' },
        { id_producto: CHAMPINON.id, cantidad: t.topping * 0.6, unidad: 'kilogramo' },
        { id_producto: MOZARELL.id,  cantidad: t.queso,         unidad: 'kilogramo' },
      ],
    },
    {
      base: 'PT-PIZZMANZ', nombre: 'Pizza de Manzana',
      descripcion: 'Pizza de la casa: mozzarella, manzana caramelizada al vino, tocineta y reducción balsámica',
      salsaBase: SALNAP.id,
      toppings: t => [
        { id_producto: MOZARELL.id,  cantidad: t.queso,          unidad: 'kilogramo' },
        { id_producto: MANZVINO.id,  cantidad: t.topping,        unidad: 'kilogramo', notas: 'Manzana verde cocinada al vino y caramelizada' },
        { id_producto: TOCARTESA.id, cantidad: t.topping * 0.4,  unidad: 'kilogramo' },
        { id_producto: REDBALS.id,   cantidad: t.salsa * 0.5,    unidad: 'litro',     notas: 'Reducción balsámica para bañar al final' },
      ],
    },
    {
      base: 'PT-PIZZDUL', nombre: 'Pizza Dulce',
      descripcion: 'Pizza dulce con nutella y arequipe',
      toppings: t => [
        { id_producto: NUTELLA.id,  cantidad: t.salsa,          unidad: 'kilogramo' },
        { id_producto: AREQUIP.id,  cantidad: t.salsa,          unidad: 'kilogramo' },
      ],
    },
  ];

  for (const pizza of pizzas) {
    for (const tam of TAMANOS) {
      const sku = `${pizza.base}${tam.sku_sufijo}`;
      const nombre = `${pizza.nombre} (${tam.sku_sufijo === 'P' ? 'Personal' : tam.sku_sufijo === 'M' ? 'Mediana' : 'Familiar'})`;
      const ings: Ing[] = [
        { id_producto: MASAPIZ.id, cantidad: tam.masa, unidad: 'gramo' },
        ...(pizza.salsaBase ? [{ id_producto: pizza.salsaBase, cantidad: tam.salsa, unidad: 'litro' }] : []),
        ...pizza.toppings(tam),
      ];
      await upsertReceta(sku, nombre, ings,
        [
          { numero_fase: 1, nombre: 'Preparación masa', descripcion: 'Extender la masa en molde y dejar reposar 5 min.', duracion_minutos: 5 },
          { numero_fase: 2, nombre: 'Montaje',           descripcion: 'Aplicar salsa base y distribuir toppings uniformemente.', duracion_minutos: 3 },
          { numero_fase: 3, nombre: 'Horneado',          descripcion: `Hornear a 220°C por ${tam.min} minutos hasta que los bordes doren.`, duracion_minutos: tam.min },
        ],
        { tiempo_preparacion: tam.min + 8, merma_esperada_porcentaje: 5, descripcion: pizza.descripcion }
      );
    }
  }

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // ROLLS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🌀 Creando recetas de Rolls...');

  const rollTamanos = [
    { sku_suf: '6',  cantidad: 6,  masa: 300, min: 20, label: '6 und' },
    { sku_suf: '12', cantidad: 12, masa: 600, min: 35, label: '12 und' },
  ];

  for (const t of rollTamanos) {
    await upsertReceta(`PT-ROLLCAN${t.sku_suf}`, `Rolls de Canela (${t.label})`,
      [
        { id_producto: MASAPIZ.id,  cantidad: t.masa, unidad: 'gramo' },
        { id_producto: CANPOL.id,   cantidad: 0.01 * (t.cantidad / 6), unidad: 'kilogramo' },
        { id_producto: AZUPOL.id,   cantidad: 0.04 * (t.cantidad / 6), unidad: 'kilogramo' },
        { id_producto: CREMALE.id,  cantidad: 0.05 * (t.cantidad / 6), unidad: 'litro' },
        { id_producto: AREQUIP.id,  cantidad: 0.03 * (t.cantidad / 6), unidad: 'kilogramo' },
      ],
      [
        { numero_fase: 1, nombre: 'Preparación',  descripcion: 'Extender masa, esparcir relleno de canela y azúcar, enrollar y cortar en porciones.', duracion_minutos: 15 },
        { numero_fase: 2, nombre: 'Horneado',      descripcion: `Hornear a 180°C por ${t.min} minutos. Decorar con arequipe caliente.`, duracion_minutos: t.min },
      ],
      { tiempo_preparacion: t.min + 15, cantidad_producida: t.cantidad, unidad_produccion: 'unidad', merma_esperada_porcentaje: 5 }
    );

    await upsertReceta(`PT-ROLLPEP${t.sku_suf}`, `Rolls de Pepperoni (${t.label})`,
      [
        { id_producto: MASAPIZ.id,   cantidad: t.masa, unidad: 'gramo' },
        { id_producto: PEPPERONI.id, cantidad: 0.06 * (t.cantidad / 6), unidad: 'kilogramo' },
        { id_producto: MOZARELL.id,  cantidad: 0.05 * (t.cantidad / 6), unidad: 'kilogramo' },
        { id_producto: SALNAP.id,    cantidad: 0.03 * (t.cantidad / 6), unidad: 'litro' },
      ],
      [
        { numero_fase: 1, nombre: 'Preparación', descripcion: 'Extender masa, cubrir con napolitana, pepperoni y mozzarella, enrollar y cortar.', duracion_minutos: 12 },
        { numero_fase: 2, nombre: 'Horneado',     descripcion: `Hornear a 200°C por ${t.min} minutos hasta dorar.`, duracion_minutos: t.min },
      ],
      { tiempo_preparacion: t.min + 12, cantidad_producida: t.cantidad, unidad_produccion: 'unidad', merma_esperada_porcentaje: 5 }
    );

    await upsertReceta(`PT-ROLLDUC${t.sku_suf}`, `Rolls Dulces (${t.label})`,
      [
        { id_producto: MASAPIZ.id, cantidad: t.masa, unidad: 'gramo' },
        { id_producto: NUTELLA.id, cantidad: 0.04 * (t.cantidad / 6), unidad: 'kilogramo' },
        { id_producto: AZUPOL.id,  cantidad: 0.03 * (t.cantidad / 6), unidad: 'kilogramo' },
        { id_producto: AREQUIP.id, cantidad: 0.03 * (t.cantidad / 6), unidad: 'kilogramo' },
      ],
      [
        { numero_fase: 1, nombre: 'Preparación', descripcion: 'Extender masa, aplicar nutella y arequipe, enrollar y cortar.', duracion_minutos: 12 },
        { numero_fase: 2, nombre: 'Horneado',     descripcion: `Hornear a 180°C por ${t.min} minutos. Decorar con arequipe.`, duracion_minutos: t.min },
      ],
      { tiempo_preparacion: t.min + 12, cantidad_producida: t.cantidad, unidad_produccion: 'unidad', merma_esperada_porcentaje: 5 }
    );
  }

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // STROMBOLI
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🥙 Creando recetas de Stromboli...');

  const strombTam = [
    { suf: 'P', masa: 300, rell: 0.10, min: 18, label: 'Personal' },
    { suf: 'M', masa: 450, rell: 0.15, min: 25, label: 'Mediano' },
  ];

  for (const t of strombTam) {
    await upsertReceta(`PT-STROMB-PEPP-${t.suf}`, `Stromboli Pepperoni (${t.label})`,
      [
        { id_producto: MASAPIZ.id,   cantidad: t.masa,       unidad: 'gramo' },
        { id_producto: PEPPERONI.id, cantidad: t.rell,       unidad: 'kilogramo' },
        { id_producto: MOZARELL.id,  cantidad: t.rell * 0.8, unidad: 'kilogramo' },
        { id_producto: SALNAP.id,    cantidad: 0.04,         unidad: 'litro' },
      ],
      [
        { numero_fase: 1, nombre: 'Preparación', descripcion: 'Extender masa, agregar relleno y enrollar apretado. Sellar bordes.', duracion_minutos: 8 },
        { numero_fase: 2, nombre: 'Horneado',     descripcion: `Hornear a 200°C por ${t.min} min. Cortar en diagonal y servir con napolitana.`, duracion_minutos: t.min },
      ],
      { tiempo_preparacion: t.min + 8, merma_esperada_porcentaje: 5 }
    );

    await upsertReceta(`PT-STROMB-ITAL-${t.suf}`, `Stromboli Italiano (${t.label})`,
      [
        { id_producto: MASAPIZ.id,  cantidad: t.masa,       unidad: 'gramo' },
        { id_producto: PROSCIUT.id, cantidad: t.rell * 0.7, unidad: 'kilogramo' },
        { id_producto: MOZARELL.id, cantidad: t.rell * 0.8, unidad: 'kilogramo' },
        { id_producto: SALPESTO.id, cantidad: 0.04,         unidad: 'litro' },
      ],
      [
        { numero_fase: 1, nombre: 'Preparación', descripcion: 'Extender masa, pesto, prosciutto y mozzarella. Enrollar y sellar.', duracion_minutos: 8 },
        { numero_fase: 2, nombre: 'Horneado',     descripcion: `Hornear a 200°C por ${t.min} minutos.`, duracion_minutos: t.min },
      ],
      { tiempo_preparacion: t.min + 8, merma_esperada_porcentaje: 5 }
    );

    await upsertReceta(`PT-STROMB-CRIO-${t.suf}`, `Stromboli Criollo (${t.label})`,
      [
        { id_producto: MASAPIZ.id,  cantidad: t.masa,       unidad: 'gramo' },
        { id_producto: CARNDES.id,  cantidad: t.rell,       unidad: 'kilogramo' },
        { id_producto: MOZARELL.id, cantidad: t.rell * 0.8, unidad: 'kilogramo' },
        { id_producto: SALNAP.id,   cantidad: 0.04,         unidad: 'litro' },
      ],
      [
        { numero_fase: 1, nombre: 'Preparación', descripcion: 'Extender masa, napolitana, carne desmechada y mozzarella. Enrollar.', duracion_minutos: 8 },
        { numero_fase: 2, nombre: 'Horneado',     descripcion: `Hornear a 200°C por ${t.min} minutos.`, duracion_minutos: t.min },
      ],
      { tiempo_preparacion: t.min + 8, merma_esperada_porcentaje: 5 }
    );

    await upsertReceta(`PT-STROMB-HAW-${t.suf}`, `Stromboli Hawaiano (${t.label})`,
      [
        { id_producto: MASAPIZ.id,  cantidad: t.masa,       unidad: 'gramo' },
        { id_producto: PECHUGA.id,  cantidad: t.rell * 0.8, unidad: 'kilogramo' },
        { id_producto: PIÑACAR.id,  cantidad: t.rell * 0.5, unidad: 'kilogramo' },
        { id_producto: MOZARELL.id, cantidad: t.rell * 0.8, unidad: 'kilogramo' },
        { id_producto: SALNAP.id,   cantidad: 0.04,         unidad: 'litro' },
      ],
      [
        { numero_fase: 1, nombre: 'Preparación', descripcion: 'Extender masa, napolitana, pollo y piña caramelizada. Enrollar.', duracion_minutos: 8 },
        { numero_fase: 2, nombre: 'Horneado',     descripcion: `Hornear a 200°C por ${t.min} minutos.`, duracion_minutos: t.min },
      ],
      { tiempo_preparacion: t.min + 8, merma_esperada_porcentaje: 5 }
    );
  }

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // JUGOS NATURALES
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🥤 Creando recetas de Jugos...');

  const jugos: [string, string, { id_producto: number }][] = [
    ['PT-JUGOFRE',  'Jugo de Fresa 500ml',      { id_producto: PULPFRE.id }],
    ['PT-JUGOMAN',  'Jugo de Mango 500ml',       { id_producto: PULPMAN.id }],
    ['PT-JUGOGU',   'Jugo de Guanábana 500ml',   { id_producto: PULPGUA.id }],
    ['PT-JUGOMOR',  'Jugo de Mora 500ml',        { id_producto: PULPMORA.id }],
    ['PT-JUGOPIÑA', 'Jugo de Piña 500ml',        { id_producto: PULPPIÑA.id }],
  ];

  for (const [sku, nombre, pulpa] of jugos) {
    await upsertReceta(sku, nombre,
      [
        { ...pulpa, cantidad: 0.12, unidad: 'litro' },
        { id_producto: LECHEENT.id, cantidad: 0.30, unidad: 'litro' },
        { id_producto: AZUPOL.id,   cantidad: 0.02, unidad: 'kilogramo' },
      ],
      [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Licuar pulpa con leche fría y azúcar. Servir en vaso con hielo.', duracion_minutos: 3 }],
      { cantidad_producida: 500, unidad_produccion: 'mililitro' }
    );
  }

  // ── Mezclas ───────────────────────────────────────────────────────────────
  const mezclas: [string, string, { id_producto: number }, { id_producto: number }][] = [
    ['PT-MEZNARPI',  'Mezcla Naranja-Piña 500ml',      { id_producto: PULPNAR.id },  { id_producto: PULPPIÑA.id }],
    ['PT-MEZFREMA',  'Mezcla Fresa-Mandarina 500ml',   { id_producto: PULPFRE.id },  { id_producto: PULPMANDR.id }],
    ['PT-MEZMANGMA', 'Mezcla Mango-Mandarina 500ml',   { id_producto: PULPMAN.id },  { id_producto: PULPMANDR.id }],
    ['PT-MEZMARMAN', 'Mezcla Maracuyá-Mango 500ml',    { id_producto: PULPMAR.id },  { id_producto: PULPMAN.id }],
  ];

  for (const [sku, nombre, pulpa1, pulpa2] of mezclas) {
    await upsertReceta(sku, nombre,
      [
        { ...pulpa1,  cantidad: 0.08, unidad: 'litro' },
        { ...pulpa2,  cantidad: 0.08, unidad: 'litro' },
        { id_producto: LECHEENT.id, cantidad: 0.30, unidad: 'litro' },
        { id_producto: AZUPOL.id,   cantidad: 0.02, unidad: 'kilogramo' },
      ],
      [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Licuar ambas pulpas con leche y azúcar. Servir frío.', duracion_minutos: 3 }],
      { cantidad_producida: 500, unidad_produccion: 'mililitro' }
    );
  }

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // MENÚ INFANTIL
  // ══════════════════════════════════════════════════════════════════════════
  console.log('👶 Creando receta Menú Infantil...');

  await upsertReceta('PT-MENUINF', 'Menú Infantil',
    [
      { id_producto: PECHUGA.id,    cantidad: 0.10, unidad: 'kilogramo', notas: 'Chicken tenders' },
      { id_producto: PANKO.id,      cantidad: 0.03, unidad: 'kilogramo' },
      { id_producto: HUEVO.id,      cantidad: 1,    unidad: 'unidad' },
      { id_producto: PAPASCASA.id,  cantidad: 1,    unidad: 'porcion',   notas: 'Papas de la casa' },
      { id_producto: LECHEENT.id,   cantidad: 0.30, unidad: 'litro',     notas: 'Jugo en caja simulado' },
      { id_producto: NUTELLA.id,    cantidad: 0.02, unidad: 'kilogramo', notas: 'Chocolatina' },
    ],
    [
      { numero_fase: 1, nombre: 'Chicken Tenders', descripcion: 'Empanar y freír la pechuga en tiras.', duracion_minutos: 12 },
      { numero_fase: 2, nombre: 'Montaje',          descripcion: 'Servir tenders con papas de la casa, jugo y chocolatina. Incluir sorpresa.', duracion_minutos: 3 },
    ],
    { tiempo_preparacion: 15, descripcion: 'Chicken tenders, papas de la casa, jugo, chocolatina y sorpresa' }
  );

  console.log('');

  // ══════════════════════════════════════════════════════════════════════════
  // ADICIONES
  // ══════════════════════════════════════════════════════════════════════════
  console.log('➕ Creando recetas de Adiciones...');

  await upsertReceta('PT-ADCARNE', 'Adición: Carne de Hamburguesa',
    [{ id_producto: CARNDES.id, cantidad: 0.10, unidad: 'kilogramo' }],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Porcionar y calentar la carne desmechada.', duracion_minutos: 3 }],
    {}
  );

  await upsertReceta('PT-ADTOCINO', 'Adición: Tocino',
    [{ id_producto: TOCARTESA.id, cantidad: 0.05, unidad: 'kilogramo' }],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Porcionar la tocineta artesanal. Servir fría o caliente.', duracion_minutos: 2 }],
    {}
  );

  await upsertReceta('PT-ADPEPINI', 'Adición: Pepinillos',
    [{ id_producto: PEPINILLO.id, cantidad: 0.03, unidad: 'kilogramo' }],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Laminar pepinillos en rodajas finas.', duracion_minutos: 2 }],
    {}
  );

  await upsertReceta('PT-ADTOMATE', 'Adición: Tomate en Reducción de Limonaria',
    [
      { id_producto: TOMLIMON.id, cantidad: 0.05, unidad: 'kilogramo', notas: 'Porción de tomate en reducción ya preparada' },
    ],
    [{ numero_fase: 1, nombre: 'Servicio', descripcion: 'Porcionar rodajas de tomate en reducción de limonaria ya preparadas.', duracion_minutos: 1 }],
    {}
  );

  await upsertReceta('PT-ADCEBOLLA', 'Adición: Cebolla Caramelizada en Vino Tinto',
    [{ id_producto: CEBCARAMEL.id, cantidad: 0.04, unidad: 'kilogramo' }],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Porcionar la cebolla caramelizada ya preparada.', duracion_minutos: 1 }],
    {}
  );

  await upsertReceta('PT-ADMANZANA', 'Adición: Manzana Verde Caramelizada',
    [{ id_producto: MANZVINO.id, cantidad: 0.04, unidad: 'kilogramo' }],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Porcionar la manzana ya reducida con vino.', duracion_minutos: 1 }],
    {}
  );

  await upsertReceta('PT-ADHCODO', 'Adición: Huevos de Codorniz (Unidad)',
    [{ id_producto: HCODO.id, cantidad: 2, unidad: 'unidad' }],
    [{ numero_fase: 1, nombre: 'Preparación', descripcion: 'Servir los huevos de codorniz cocidos con sal.', duracion_minutos: 1 }],
    {}
  );

  console.log('');

  // ── Resumen ───────────────────────────────────────────────────────────────
  const total = await prisma.receta.count();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ ¡Seed Recetas Vylonia completado!');
  console.log(`📋 Total recetas en BD: ${total}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 Recetas de bebidas embotelladas (Coca Cola, Sprite, etc.) no generadas');
  console.log('   → Se venden directamente del stock, sin receta.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('❌ Error en seed recetas:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
