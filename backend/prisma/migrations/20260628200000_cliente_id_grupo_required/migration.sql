-- AlterTable: make id_grupo NOT NULL on clientes (safe — table is empty)
ALTER TABLE "clientes" DROP CONSTRAINT "clientes_id_grupo_fkey";
ALTER TABLE "clientes" ALTER COLUMN "id_grupo" SET NOT NULL;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "grupo_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
