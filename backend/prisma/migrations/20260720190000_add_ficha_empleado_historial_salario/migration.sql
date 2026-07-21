-- ============================================================================
-- FASE 1 — Ficha del empleado e historial salarial
-- ============================================================================
--
-- Amplía Usuario con los datos que faltaban para tratar a la persona como
-- EMPLEADO y no solo como cuenta de acceso, y añade el histórico de salarios.
--
-- Decisiones:
--   • estado_laboral es INDEPENDIENTE de `estado` (el de la cuenta). Un
--     empleado en vacaciones conserva cuenta activa; uno retirado conserva
--     ficha e historial aunque pierda acceso.
--   • tipo_documento reutiliza el enum TipoDocumento que ya usaba Cliente,
--     en lugar de crear uno paralelo.
--   • codigo_empleado NO lleva UNIQUE en base de datos: Usuario no tiene
--     columna id_grupo (la pertenencia es vía UsuarioGrupo/UsuarioRestaurante),
--     así que un UNIQUE global impediría que dos grupos usen "EMP-0001". La
--     unicidad por grupo se valida en usuarioService dentro de la transacción
--     de creación.
--   • id_restaurante_base es la sede que asume el costo laboral: ancla de
--     tenant para liquidar nómina y emitir documentos. Un usuario puede tener
--     acceso a N sedes, pero se liquida en una sola.
-- ============================================================================

-- CreateEnum
CREATE TYPE "EstadoLaboral" AS ENUM ('activo', 'periodo_prueba', 'vacaciones', 'incapacidad', 'licencia', 'suspendido', 'retirado');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "afp" VARCHAR(100),
ADD COLUMN     "arl" VARCHAR(100),
ADD COLUMN     "caja_compensacion" VARCHAR(100),
ADD COLUMN     "codigo_empleado" VARCHAR(20),
ADD COLUMN     "eps" VARCHAR(100),
ADD COLUMN     "estado_laboral" "EstadoLaboral" NOT NULL DEFAULT 'activo',
ADD COLUMN     "fecha_retiro" TIMESTAMP(3),
ADD COLUMN     "fondo_cesantias" VARCHAR(100),
ADD COLUMN     "foto_url" VARCHAR(500),
ADD COLUMN     "id_jefe_directo" INTEGER,
ADD COLUMN     "id_restaurante_base" INTEGER,
ADD COLUMN     "jornada" VARCHAR(20),
ADD COLUMN     "motivo_retiro" VARCHAR(300),
ADD COLUMN     "nivel_riesgo_arl" VARCHAR(5),
ADD COLUMN     "tipo_documento" "TipoDocumento";

-- CreateTable
CREATE TABLE "historial_salarios" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "salario_anterior" DECIMAL(12,2),
    "salario_nuevo" DECIMAL(12,2) NOT NULL,
    "tipo_pago" VARCHAR(20) NOT NULL,
    "vigencia_desde" TIMESTAMP(3) NOT NULL,
    "motivo" VARCHAR(300),
    "id_registrado_por" INTEGER,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_salarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historial_salarios_id_usuario_vigencia_desde_idx" ON "historial_salarios"("id_usuario", "vigencia_desde");

-- CreateIndex
CREATE INDEX "usuarios_codigo_empleado_idx" ON "usuarios"("codigo_empleado");

-- CreateIndex
CREATE INDEX "usuarios_estado_laboral_idx" ON "usuarios"("estado_laboral");

-- CreateIndex
CREATE INDEX "usuarios_id_restaurante_base_idx" ON "usuarios"("id_restaurante_base");

-- CreateIndex
CREATE INDEX "usuarios_id_jefe_directo_idx" ON "usuarios"("id_jefe_directo");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_restaurante_base_fkey" FOREIGN KEY ("id_restaurante_base") REFERENCES "restaurantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_jefe_directo_fkey" FOREIGN KEY ("id_jefe_directo") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_salarios" ADD CONSTRAINT "historial_salarios_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_salarios" ADD CONSTRAINT "historial_salarios_id_registrado_por_fkey" FOREIGN KEY ("id_registrado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- Normalización de datos: dominio de tipo_contrato
-- ============================================================================
--
-- El dominio anterior mezclaba dos conceptos distintos:
--   'fijo' | 'parcial' | 'temporal'
-- 'parcial' no es un tipo de contrato sino una JORNADA. El dominio nuevo los
-- separa, alineado con la legislación laboral colombiana:
--   tipo_contrato: indefinido | fijo | obra_labor | aprendizaje
--   jornada:       completa   | parcial | por_horas
--
-- Mapeo aplicado:
--   'parcial'  → tipo_contrato = 'indefinido', jornada = 'parcial'
--   'temporal' → tipo_contrato = 'fijo',       jornada = 'completa'
--   'fijo'     → tipo_contrato = 'fijo',       jornada = 'completa'
--   NULL       → se deja NULL (sin dato es sin dato; no se inventa)
--
-- En la base de datos de desarrollo esto es un no-op (los 3 usuarios existentes
-- tienen tipo_contrato NULL); se incluye para entornos con datos reales.

UPDATE "usuarios" SET "tipo_contrato" = 'indefinido', "jornada" = 'parcial'
WHERE "tipo_contrato" = 'parcial';

UPDATE "usuarios" SET "tipo_contrato" = 'fijo', "jornada" = 'completa'
WHERE "tipo_contrato" IN ('temporal', 'fijo') AND "jornada" IS NULL;
