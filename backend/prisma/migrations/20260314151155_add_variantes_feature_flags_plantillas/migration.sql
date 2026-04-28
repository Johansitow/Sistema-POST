-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "color" VARCHAR(20),
ADD COLUMN     "icono" VARCHAR(50);

-- AlterTable
ALTER TABLE "orden_detalles" ADD COLUMN     "id_variante" INTEGER;

-- CreateTable
CREATE TABLE "producto_variantes" (
    "id" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "sku" VARCHAR(50),
    "atributos" JSONB,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producto_variantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "scope" VARCHAR(20) NOT NULL DEFAULT 'global',
    "metadata" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_asignaciones" (
    "id" SERIAL NOT NULL,
    "id_feature_flag" INTEGER NOT NULL,
    "contexto" VARCHAR(100) NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "feature_flag_asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_configuraciones" (
    "id" SERIAL NOT NULL,
    "scope" VARCHAR(50) NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" JSONB NOT NULL,
    "contexto" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 1,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_configuraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_impresion" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "plantilla" JSONB NOT NULL,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_impresion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "producto_variantes_sku_key" ON "producto_variantes"("sku");

-- CreateIndex
CREATE INDEX "producto_variantes_id_producto_idx" ON "producto_variantes"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_nombre_key" ON "feature_flags"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_asignaciones_id_feature_flag_contexto_key" ON "feature_flag_asignaciones"("id_feature_flag", "contexto");

-- CreateIndex
CREATE UNIQUE INDEX "ui_configuraciones_scope_clave_contexto_key" ON "ui_configuraciones"("scope", "clave", "contexto");

-- CreateIndex
CREATE INDEX "orden_detalles_id_variante_idx" ON "orden_detalles"("id_variante");

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_detalles" ADD CONSTRAINT "orden_detalles_id_variante_fkey" FOREIGN KEY ("id_variante") REFERENCES "producto_variantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_asignaciones" ADD CONSTRAINT "feature_flag_asignaciones_id_feature_flag_fkey" FOREIGN KEY ("id_feature_flag") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
