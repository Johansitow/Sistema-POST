-- DropForeignKey
ALTER TABLE "ordenes" DROP CONSTRAINT "ordenes_id_orden_grupo_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_grupo" DROP CONSTRAINT "ordenes_grupo_id_grupo_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_grupo" DROP CONSTRAINT "ordenes_grupo_id_usuario_fkey";

-- DropForeignKey
ALTER TABLE "pagos_grupo" DROP CONSTRAINT "pagos_grupo_id_metodo_pago_fkey";

-- DropForeignKey
ALTER TABLE "pagos_grupo" DROP CONSTRAINT "pagos_grupo_id_orden_grupo_fkey";

-- DropIndex
DROP INDEX "ordenes_id_orden_grupo_idx";

-- AlterTable
ALTER TABLE "ordenes" DROP COLUMN "id_orden_grupo",
DROP COLUMN "sufijo_orden";

-- DropTable
DROP TABLE "ordenes_grupo";

-- DropTable
DROP TABLE "pagos_grupo";

