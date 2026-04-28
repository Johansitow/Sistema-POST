-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "cargo" VARCHAR(100),
ADD COLUMN     "contacto_emergencia_nombre" VARCHAR(200),
ADD COLUMN     "contacto_emergencia_telefono" VARCHAR(20),
ADD COLUMN     "direccion" VARCHAR(300),
ADD COLUMN     "documento_identidad" VARCHAR(20),
ADD COLUMN     "fecha_ingreso" TIMESTAMP(3),
ADD COLUMN     "fecha_nacimiento" TIMESTAMP(3),
ADD COLUMN     "notas" TEXT,
ADD COLUMN     "tipo_contrato" VARCHAR(20),
ADD COLUMN     "turno" VARCHAR(20);

-- CreateTable
CREATE TABLE "nomina_empleados" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "salario_base" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tipo_pago" VARCHAR(20) NOT NULL DEFAULT 'mensual',
    "banco" VARCHAR(100),
    "tipo_cuenta" VARCHAR(20),
    "numero_cuenta" VARCHAR(30),
    "observaciones" TEXT,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nomina_empleados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nomina_empleados_id_usuario_key" ON "nomina_empleados"("id_usuario");

-- AddForeignKey
ALTER TABLE "nomina_empleados" ADD CONSTRAINT "nomina_empleados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
