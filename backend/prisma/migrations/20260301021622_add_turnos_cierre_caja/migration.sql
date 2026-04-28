-- CreateEnum
CREATE TYPE "EstadoCierre" AS ENUM ('pendiente', 'en_proceso', 'completado', 'con_diferencia');

-- AlterTable
ALTER TABLE "cierres_caja" ADD COLUMN     "estado" "EstadoCierre" NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "id_turno" INTEGER,
ADD COLUMN     "justificacion" TEXT;

-- CreateTable
CREATE TABLE "turnos_caja" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "hora_apertura" VARCHAR(5) NOT NULL,
    "hora_cierre" VARCHAR(5) NOT NULL,
    "dias_semana" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_caja_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_id_turno_fkey" FOREIGN KEY ("id_turno") REFERENCES "turnos_caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
