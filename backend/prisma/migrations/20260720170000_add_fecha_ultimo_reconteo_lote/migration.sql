-- Reconteo programable por lote: guarda cuándo se hizo el último reconteo
-- para controlar la frecuencia permitida (cada N días, configurable por sede).
ALTER TABLE "lotes" ADD COLUMN "fecha_ultimo_reconteo" TIMESTAMP(3);
