-- CreateEnum
CREATE TYPE "EstadoPeriodoNomina" AS ENUM ('borrador', 'en_revision', 'aprobada', 'pagada', 'anulada');

-- CreateEnum
CREATE TYPE "TipoConceptoNomina" AS ENUM ('devengado', 'deduccion', 'aporte_empleador', 'provision');

-- CreateEnum
CREATE TYPE "TipoNovedadNomina" AS ENUM ('hora_extra_diurna', 'hora_extra_nocturna', 'hora_extra_dominical', 'recargo_nocturno', 'dominical_festivo', 'incapacidad_comun', 'incapacidad_laboral', 'licencia_no_remunerada', 'vacaciones', 'bonificacion', 'comision', 'prestamo', 'anticipo', 'descuento_otro');

-- CreateTable
CREATE TABLE "parametros_nomina" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "salario_minimo" DECIMAL(12,2) NOT NULL,
    "auxilio_transporte" DECIMAL(12,2) NOT NULL,
    "tope_auxilio_smmlv" INTEGER NOT NULL DEFAULT 2,
    "uvt" DECIMAL(12,2) NOT NULL,
    "porc_salud_empleado" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "porc_pension_empleado" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "porc_salud_empleador" DECIMAL(5,2) NOT NULL DEFAULT 8.5,
    "porc_pension_empleador" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "porc_caja_compensacion" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "porc_icbf" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "porc_sena" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "porc_recargo_nocturno" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "porc_extra_diurna" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "porc_extra_nocturna" DECIMAL(5,2) NOT NULL DEFAULT 75,
    "porc_dominical" DECIMAL(5,2) NOT NULL DEFAULT 75,
    "porc_extra_dominical_diurna" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "horas_mensuales" INTEGER NOT NULL DEFAULT 230,
    "porc_cesantias" DECIMAL(5,2) NOT NULL DEFAULT 8.33,
    "porc_interes_cesantias" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "porc_prima" DECIMAL(5,2) NOT NULL DEFAULT 8.33,
    "porc_vacaciones" DECIMAL(5,2) NOT NULL DEFAULT 4.17,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "verificado_por" INTEGER,
    "fecha_verificacion" TIMESTAMP(3),
    "notas" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametros_nomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos_nomina" (
    "id" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_restaurante" INTEGER,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo_periodo" VARCHAR(20) NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "anio" INTEGER NOT NULL,
    "estado" "EstadoPeriodoNomina" NOT NULL DEFAULT 'borrador',
    "total_devengado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_deducciones" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_neto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_aportes_empleador" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_provisiones" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "empleados_liquidados" INTEGER NOT NULL DEFAULT 0,
    "id_liquidado_por" INTEGER,
    "fecha_liquidacion" TIMESTAMP(3),
    "id_aprobado_por" INTEGER,
    "fecha_aprobacion" TIMESTAMP(3),
    "fecha_pago" TIMESTAMP(3),
    "observaciones" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodos_nomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novedades_nomina" (
    "id" SERIAL NOT NULL,
    "id_periodo" INTEGER NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "tipo" "TipoNovedadNomina" NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "observaciones" VARCHAR(500),
    "id_registrado_por" INTEGER,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novedades_nomina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nomina_detalles" (
    "id" SERIAL NOT NULL,
    "id_periodo" INTEGER NOT NULL,
    "id_empleado" INTEGER NOT NULL,
    "salario_base" DECIMAL(12,2) NOT NULL,
    "dias_trabajados" DECIMAL(5,2) NOT NULL,
    "ibc" DECIMAL(12,2) NOT NULL,
    "total_devengado" DECIMAL(12,2) NOT NULL,
    "total_deducciones" DECIMAL(12,2) NOT NULL,
    "neto_pagar" DECIMAL(12,2) NOT NULL,
    "aportes_empleador" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "provisiones" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "banco" VARCHAR(100),
    "tipo_cuenta" VARCHAR(20),
    "numero_cuenta" VARCHAR(30),

    CONSTRAINT "nomina_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nomina_detalle_conceptos" (
    "id" SERIAL NOT NULL,
    "id_detalle" INTEGER NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" "TipoConceptoNomina" NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor" DECIMAL(12,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nomina_detalle_conceptos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parametros_nomina_anio_key" ON "parametros_nomina"("anio");

-- CreateIndex
CREATE INDEX "periodos_nomina_id_grupo_anio_idx" ON "periodos_nomina"("id_grupo", "anio");

-- CreateIndex
CREATE INDEX "periodos_nomina_estado_idx" ON "periodos_nomina"("estado");

-- CreateIndex
CREATE INDEX "novedades_nomina_id_periodo_id_empleado_idx" ON "novedades_nomina"("id_periodo", "id_empleado");

-- CreateIndex
CREATE INDEX "nomina_detalles_id_empleado_idx" ON "nomina_detalles"("id_empleado");

-- CreateIndex
CREATE UNIQUE INDEX "nomina_detalles_id_periodo_id_empleado_key" ON "nomina_detalles"("id_periodo", "id_empleado");

-- CreateIndex
CREATE INDEX "nomina_detalle_conceptos_id_detalle_idx" ON "nomina_detalle_conceptos"("id_detalle");

-- AddForeignKey
ALTER TABLE "periodos_nomina" ADD CONSTRAINT "periodos_nomina_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_nomina" ADD CONSTRAINT "periodos_nomina_id_restaurante_fkey" FOREIGN KEY ("id_restaurante") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_nomina" ADD CONSTRAINT "periodos_nomina_id_liquidado_por_fkey" FOREIGN KEY ("id_liquidado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodos_nomina" ADD CONSTRAINT "periodos_nomina_id_aprobado_por_fkey" FOREIGN KEY ("id_aprobado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades_nomina" ADD CONSTRAINT "novedades_nomina_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodos_nomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades_nomina" ADD CONSTRAINT "novedades_nomina_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades_nomina" ADD CONSTRAINT "novedades_nomina_id_registrado_por_fkey" FOREIGN KEY ("id_registrado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomina_detalles" ADD CONSTRAINT "nomina_detalles_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodos_nomina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomina_detalles" ADD CONSTRAINT "nomina_detalles_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nomina_detalle_conceptos" ADD CONSTRAINT "nomina_detalle_conceptos_id_detalle_fkey" FOREIGN KEY ("id_detalle") REFERENCES "nomina_detalles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

