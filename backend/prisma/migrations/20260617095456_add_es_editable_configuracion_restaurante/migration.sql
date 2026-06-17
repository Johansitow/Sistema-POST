-- AlterTable: añade es_editable a configuracion_restaurante para alinear las tres capas
-- de configuración (Configuracion global, ConfiguracionGrupo, ConfiguracionRestaurante).
-- Puramente aditivo: filas existentes quedan con es_editable = true (el default correcto).
ALTER TABLE "configuracion_restaurante" ADD COLUMN "es_editable" BOOLEAN NOT NULL DEFAULT true;
