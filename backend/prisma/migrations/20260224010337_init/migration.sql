-- CreateEnum
CREATE TYPE "EstadoGeneral" AS ENUM ('activo', 'inactivo', 'eliminado');

-- CreateEnum
CREATE TYPE "TipoDato" AS ENUM ('string', 'number', 'boolean', 'json');

-- CreateEnum
CREATE TYPE "TipoMateria" AS ENUM ('prima', 'procesada');

-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('unidad', 'gramo', 'kilogramo', 'litro', 'mililitro', 'porcion');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('entrada', 'salida', 'ajuste', 'merma', 'produccion', 'venta', 'devolucion');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('activo', 'vencido', 'agotado', 'en_produccion');

-- CreateEnum
CREATE TYPE "TipoOrden" AS ENUM ('local', 'domicilio');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('pendiente', 'pagada', 'anulada');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "es_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "color" VARCHAR(20),
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "modulo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "id" SERIAL NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "nombre_completo" VARCHAR(200) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(20),
    "usuario" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "ultimo_acceso" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "creado_por" INTEGER,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "id_usuario" INTEGER,
    "accion" VARCHAR(100) NOT NULL,
    "modulo" VARCHAR(50) NOT NULL,
    "tabla_afectada" VARCHAR(100),
    "id_registro_afectado" INTEGER,
    "datos_anteriores" JSONB,
    "datos_nuevos" JSONB,
    "ip_address" VARCHAR(50),
    "user_agent" TEXT,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" SERIAL NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo_dato" "TipoDato" NOT NULL DEFAULT 'string',
    "descripcion" TEXT,
    "categoria" VARCHAR(50) NOT NULL,
    "es_editable" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "categoria_padre" INTEGER,
    "imagen_url" VARCHAR(255),
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "codigo_barras" VARCHAR(50),
    "sku" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "id_categoria" INTEGER,
    "tipo_materia" "TipoMateria" NOT NULL,
    "unidad_medida" "UnidadMedida" NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "precio_venta" DECIMAL(12,2),
    "stock_actual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stock_maximo" DECIMAL(12,3),
    "punto_reorden" DECIMAL(12,3),
    "dias_vida_util" INTEGER,
    "requiere_refrigeracion" BOOLEAN NOT NULL DEFAULT false,
    "imagen_url" VARCHAR(255),
    "es_vendible" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" SERIAL NOT NULL,
    "id_producto_final" INTEGER NOT NULL,
    "nombre_receta" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "cantidad_producida" DECIMAL(12,3) NOT NULL,
    "unidad_produccion" "UnidadMedida" NOT NULL,
    "tiempo_preparacion" INTEGER,
    "instrucciones" TEXT,
    "notas" TEXT,
    "merma_esperada_porcentaje" DECIMAL(5,2),
    "merma_maxima_porcentaje" DECIMAL(5,2),
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_ingredientes" (
    "id" SERIAL NOT NULL,
    "id_receta" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "unidad" "UnidadMedida" NOT NULL,
    "es_opcional" BOOLEAN NOT NULL DEFAULT false,
    "notas" VARCHAR(255),
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receta_ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "tipo_movimiento" "TipoMovimiento" NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "stock_anterior" DECIMAL(12,3) NOT NULL,
    "stock_nuevo" DECIMAL(12,3) NOT NULL,
    "motivo" VARCHAR(255) NOT NULL,
    "id_proveedor" INTEGER,
    "id_lote" INTEGER,
    "id_orden" INTEGER,
    "referencia" VARCHAR(100),
    "fecha_movimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_alerta" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "icono" VARCHAR(50),
    "color" VARCHAR(20),
    "prioridad_default" VARCHAR(20) NOT NULL DEFAULT 'media',
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" SERIAL NOT NULL,
    "id_tipo_alerta" INTEGER NOT NULL,
    "id_producto" INTEGER,
    "mensaje" TEXT NOT NULL,
    "nivel_prioridad" VARCHAR(20) NOT NULL,
    "es_leida" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_leida" TIMESTAMP(3),

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_orden" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "color" VARCHAR(20),
    "icono" VARCHAR(50),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_inicial" BOOLEAN NOT NULL DEFAULT false,
    "es_final" BOOLEAN NOT NULL DEFAULT false,
    "permite_edicion" BOOLEAN NOT NULL DEFAULT true,
    "imprime_comanda" BOOLEAN NOT NULL DEFAULT false,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estados_orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado_transiciones" (
    "id" SERIAL NOT NULL,
    "id_estado_desde" INTEGER NOT NULL,
    "id_estado_hacia" INTEGER NOT NULL,
    "requiere_permiso" VARCHAR(100),
    "puede_ser_automatico" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estado_transiciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "icono" VARCHAR(50),
    "requiere_referencia" BOOLEAN NOT NULL DEFAULT false,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes" (
    "id" SERIAL NOT NULL,
    "numero_orden" VARCHAR(50) NOT NULL,
    "tipo_orden" "TipoOrden" NOT NULL DEFAULT 'local',
    "id_estado" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "direccion_entrega" VARCHAR(255),
    "telefono_contacto" VARCHAR(20),
    "nombre_contacto" VARCHAR(100),
    "notas_entrega" TEXT,
    "costo_domicilio" DECIMAL(10,2),
    "plataforma_delivery" VARCHAR(50),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "propina" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "fecha_apertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_confirmacion" TIMESTAMP(3),
    "fecha_entrega" TIMESTAMP(3),
    "fecha_cancelacion" TIMESTAMP(3),
    "motivo_cancelacion" TEXT,

    CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_detalles" (
    "id" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "notas" VARCHAR(255),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "numero_factura" VARCHAR(50) NOT NULL,
    "estado_factura" "EstadoFactura" NOT NULL DEFAULT 'pendiente',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "impuestos" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_pago" TIMESTAMP(3),

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "id_orden" INTEGER NOT NULL,
    "id_metodo_pago" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "referencia" VARCHAR(100),
    "notas" TEXT,
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" SERIAL NOT NULL,
    "numero_lote" VARCHAR(50) NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad_producida" DECIMAL(12,3) NOT NULL,
    "merma_cantidad" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "merma_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fecha_produccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" TIMESTAMP(3),
    "estado_lote" "EstadoLote" NOT NULL DEFAULT 'activo',
    "costo_produccion" DECIMAL(12,2),
    "observaciones" TEXT,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nit" VARCHAR(50),
    "contacto_nombre" VARCHAR(150),
    "contacto_telefono" VARCHAR(20),
    "contacto_email" VARCHAR(150),
    "direccion" VARCHAR(255),
    "ciudad" VARCHAR(100),
    "calificacion" DECIMAL(3,2),
    "tiempo_entrega_promedio" INTEGER,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor_productos" (
    "id" SERIAL NOT NULL,
    "id_proveedor" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "tiempo_entrega" INTEGER,
    "cantidad_minima" DECIMAL(12,3),
    "es_proveedor_preferido" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoGeneral" NOT NULL DEFAULT 'activo',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedor_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_caja" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "numero_cierre" VARCHAR(50) NOT NULL,
    "fecha_apertura" TIMESTAMP(3) NOT NULL,
    "fecha_cierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto_inicial" DECIMAL(12,2) NOT NULL,
    "monto_final" DECIMAL(12,2) NOT NULL,
    "totales_por_metodo" JSONB,
    "total_ventas" DECIMAL(12,2) NOT NULL,
    "total_efectivo" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT,

    CONSTRAINT "cierres_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_nombre_key" ON "permisos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "rol_permisos_id_rol_id_permiso_key" ON "rol_permisos"("id_rol", "id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_uuid_key" ON "usuarios"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE INDEX "auditoria_id_usuario_idx" ON "auditoria"("id_usuario");

-- CreateIndex
CREATE INDEX "auditoria_fecha_hora_idx" ON "auditoria"("fecha_hora");

-- CreateIndex
CREATE INDEX "auditoria_modulo_idx" ON "auditoria"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_clave_key" ON "configuracion"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_codigo_barras_key" ON "productos"("codigo_barras");

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE INDEX "productos_id_categoria_idx" ON "productos"("id_categoria");

-- CreateIndex
CREATE INDEX "productos_tipo_materia_idx" ON "productos"("tipo_materia");

-- CreateIndex
CREATE INDEX "productos_sku_idx" ON "productos"("sku");

-- CreateIndex
CREATE INDEX "movimientos_id_producto_idx" ON "movimientos"("id_producto");

-- CreateIndex
CREATE INDEX "movimientos_fecha_movimiento_idx" ON "movimientos"("fecha_movimiento");

-- CreateIndex
CREATE INDEX "movimientos_tipo_movimiento_idx" ON "movimientos"("tipo_movimiento");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_alerta_nombre_key" ON "tipos_alerta"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_alerta_codigo_key" ON "tipos_alerta"("codigo");

-- CreateIndex
CREATE INDEX "alertas_es_leida_idx" ON "alertas"("es_leida");

-- CreateIndex
CREATE INDEX "alertas_fecha_creacion_idx" ON "alertas"("fecha_creacion");

-- CreateIndex
CREATE INDEX "alertas_nivel_prioridad_idx" ON "alertas"("nivel_prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "estados_orden_nombre_key" ON "estados_orden"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "estados_orden_codigo_key" ON "estados_orden"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estado_transiciones_id_estado_desde_id_estado_hacia_key" ON "estado_transiciones"("id_estado_desde", "id_estado_hacia");

-- CreateIndex
CREATE UNIQUE INDEX "metodos_pago_nombre_key" ON "metodos_pago"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "metodos_pago_codigo_key" ON "metodos_pago"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_numero_orden_key" ON "ordenes"("numero_orden");

-- CreateIndex
CREATE INDEX "ordenes_numero_orden_idx" ON "ordenes"("numero_orden");

-- CreateIndex
CREATE INDEX "ordenes_id_estado_idx" ON "ordenes"("id_estado");

-- CreateIndex
CREATE INDEX "ordenes_tipo_orden_idx" ON "ordenes"("tipo_orden");

-- CreateIndex
CREATE INDEX "ordenes_fecha_apertura_idx" ON "ordenes"("fecha_apertura");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_id_orden_key" ON "facturas"("id_orden");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_numero_factura_key" ON "facturas"("numero_factura");

-- CreateIndex
CREATE INDEX "facturas_numero_factura_idx" ON "facturas"("numero_factura");

-- CreateIndex
CREATE INDEX "facturas_estado_factura_idx" ON "facturas"("estado_factura");

-- CreateIndex
CREATE INDEX "pagos_id_orden_idx" ON "pagos"("id_orden");

-- CreateIndex
CREATE INDEX "pagos_fecha_pago_idx" ON "pagos"("fecha_pago");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_numero_lote_key" ON "lotes"("numero_lote");

-- CreateIndex
CREATE INDEX "lotes_numero_lote_idx" ON "lotes"("numero_lote");

-- CreateIndex
CREATE INDEX "lotes_id_producto_idx" ON "lotes"("id_producto");

-- CreateIndex
CREATE INDEX "lotes_fecha_vencimiento_idx" ON "lotes"("fecha_vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_nit_key" ON "proveedores"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_productos_id_proveedor_id_producto_key" ON "proveedor_productos"("id_proveedor", "id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_caja_numero_cierre_key" ON "cierres_caja"("numero_cierre");

-- CreateIndex
CREATE INDEX "cierres_caja_fecha_cierre_idx" ON "cierres_caja"("fecha_cierre");

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_categoria_padre_fkey" FOREIGN KEY ("categoria_padre") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_id_producto_final_fkey" FOREIGN KEY ("id_producto_final") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_ingredientes" ADD CONSTRAINT "receta_ingredientes_id_receta_fkey" FOREIGN KEY ("id_receta") REFERENCES "recetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_ingredientes" ADD CONSTRAINT "receta_ingredientes_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_id_tipo_alerta_fkey" FOREIGN KEY ("id_tipo_alerta") REFERENCES "tipos_alerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estado_transiciones" ADD CONSTRAINT "estado_transiciones_id_estado_desde_fkey" FOREIGN KEY ("id_estado_desde") REFERENCES "estados_orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estado_transiciones" ADD CONSTRAINT "estado_transiciones_id_estado_hacia_fkey" FOREIGN KEY ("id_estado_hacia") REFERENCES "estados_orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_id_estado_fkey" FOREIGN KEY ("id_estado") REFERENCES "estados_orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_detalles" ADD CONSTRAINT "orden_detalles_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_detalles" ADD CONSTRAINT "orden_detalles_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_orden_fkey" FOREIGN KEY ("id_orden") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "metodos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor_productos" ADD CONSTRAINT "proveedor_productos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
