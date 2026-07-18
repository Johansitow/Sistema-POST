-- CreateTable
CREATE TABLE "grupos_menu" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_modulo_menu" (
    "id" SERIAL NOT NULL,
    "path" VARCHAR(100) NOT NULL,
    "id_grupo_menu" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "asignaciones_modulo_menu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_modulo_menu_path_key" ON "asignaciones_modulo_menu"("path");

-- CreateIndex
CREATE INDEX "asignaciones_modulo_menu_id_grupo_menu_idx" ON "asignaciones_modulo_menu"("id_grupo_menu");

-- AddForeignKey
ALTER TABLE "asignaciones_modulo_menu" ADD CONSTRAINT "asignaciones_modulo_menu_id_grupo_menu_fkey" FOREIGN KEY ("id_grupo_menu") REFERENCES "grupos_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: reproduce la estructura actual hardcodeada de Layout.tsx (menuGroups) tal cual,
-- para que nada cambie visualmente hasta que un admin edite el menú desde Personalización.
INSERT INTO "grupos_menu" ("nombre", "orden", "fecha_modificacion") VALUES
  ('Principal',  0, CURRENT_TIMESTAMP),
  ('Ventas',     1, CURRENT_TIMESTAMP),
  ('Inventario', 2, CURRENT_TIMESTAMP),
  ('Finanzas',   3, CURRENT_TIMESTAMP);

INSERT INTO "asignaciones_modulo_menu" ("path", "id_grupo_menu", "orden", "visible") VALUES
  ('/dashboard',      (SELECT id FROM "grupos_menu" WHERE nombre = 'Principal'),  0, true),
  ('/ordenes',        (SELECT id FROM "grupos_menu" WHERE nombre = 'Ventas'),     0, true),
  ('/cocina',         (SELECT id FROM "grupos_menu" WHERE nombre = 'Ventas'),     1, true),
  ('/clientes',       (SELECT id FROM "grupos_menu" WHERE nombre = 'Ventas'),     2, true),
  ('/proveedores',    (SELECT id FROM "grupos_menu" WHERE nombre = 'Ventas'),     3, true),
  ('/inventario',     (SELECT id FROM "grupos_menu" WHERE nombre = 'Inventario'), 0, true),
  ('/recetas',        (SELECT id FROM "grupos_menu" WHERE nombre = 'Inventario'), 1, true),
  ('/listas-compras', (SELECT id FROM "grupos_menu" WHERE nombre = 'Inventario'), 2, true),
  ('/facturas',       (SELECT id FROM "grupos_menu" WHERE nombre = 'Finanzas'),   0, true),
  ('/caja',           (SELECT id FROM "grupos_menu" WHERE nombre = 'Finanzas'),   1, true),
  ('/reportes',       (SELECT id FROM "grupos_menu" WHERE nombre = 'Finanzas'),   2, true);
