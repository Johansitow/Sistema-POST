/**
 * FacturaService - Lógica de negocio para facturas
 *
 * generarDesdeOrden() es llamado internamente por orden.service
 * cuando una orden pasa al estado EN_PREPARACION.
 * Acepta una transacción Prisma (tx) para ejecutarse dentro
 * del mismo atomic block que el cambio de estado.
 */
import { EstadoFactura } from '@prisma/client';
export declare const facturaService: {
    listar(params: {
        page?: unknown;
        limit?: unknown;
        estado_factura?: EstadoFactura;
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        orden: {
            usuario: {
                id: number;
                nombre_completo: string;
            };
            estado: {
                orden: number;
                activo: boolean;
                id: number;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                es_sistema: boolean;
                color: string | null;
                codigo: string;
                icono: string | null;
                es_inicial: boolean;
                es_final: boolean;
                permite_edicion: boolean;
                imprime_comanda: boolean;
            };
            pagos: ({
                metodo_pago: {
                    orden: number;
                    activo: boolean;
                    id: number;
                    fecha_creacion: Date;
                    nombre: string;
                    descripcion: string | null;
                    es_sistema: boolean;
                    codigo: string;
                    icono: string | null;
                    requiere_referencia: boolean;
                };
            } & {
                id: number;
                id_orden: number;
                referencia: string | null;
                notas: string | null;
                fecha_pago: Date;
                monto: import("@prisma/client/runtime/library").Decimal;
                id_metodo_pago: number;
            })[];
        } & {
            id: number;
            total: import("@prisma/client/runtime/library").Decimal;
            numero_orden: string;
            tipo_orden: import(".prisma/client").$Enums.TipoOrden;
            id_estado: number;
            id_usuario: number;
            direccion_entrega: string | null;
            telefono_contacto: string | null;
            nombre_contacto: string | null;
            notas_entrega: string | null;
            costo_domicilio: import("@prisma/client/runtime/library").Decimal | null;
            plataforma_delivery: string | null;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            descuento: import("@prisma/client/runtime/library").Decimal;
            impuestos: import("@prisma/client/runtime/library").Decimal;
            propina: import("@prisma/client/runtime/library").Decimal;
            observaciones: string | null;
            fecha_apertura: Date;
            fecha_confirmacion: Date | null;
            fecha_entrega: Date | null;
            fecha_cancelacion: Date | null;
            motivo_cancelacion: string | null;
        };
    } & {
        id: number;
        total: import("@prisma/client/runtime/library").Decimal;
        id_orden: number;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        impuestos: import("@prisma/client/runtime/library").Decimal;
        numero_factura: string;
        estado_factura: import(".prisma/client").$Enums.EstadoFactura;
        fecha_emision: Date;
        fecha_pago: Date | null;
    }>>;
    obtenerPorId(id: number): Promise<{
        orden: {
            usuario: {
                id: number;
                nombre_completo: string;
            };
            estado: {
                orden: number;
                activo: boolean;
                id: number;
                fecha_creacion: Date;
                nombre: string;
                descripcion: string | null;
                es_sistema: boolean;
                color: string | null;
                codigo: string;
                icono: string | null;
                es_inicial: boolean;
                es_final: boolean;
                permite_edicion: boolean;
                imprime_comanda: boolean;
            };
            detalles: ({
                producto: {
                    id: number;
                    estado: import(".prisma/client").$Enums.EstadoGeneral;
                    fecha_creacion: Date;
                    fecha_modificacion: Date;
                    nombre: string;
                    descripcion: string | null;
                    codigo_barras: string | null;
                    sku: string;
                    id_categoria: number | null;
                    tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                    unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                    precio_unitario: import("@prisma/client/runtime/library").Decimal;
                    precio_venta: import("@prisma/client/runtime/library").Decimal | null;
                    stock_actual: import("@prisma/client/runtime/library").Decimal;
                    stock_minimo: import("@prisma/client/runtime/library").Decimal;
                    stock_maximo: import("@prisma/client/runtime/library").Decimal | null;
                    punto_reorden: import("@prisma/client/runtime/library").Decimal | null;
                    dias_vida_util: number | null;
                    requiere_refrigeracion: boolean;
                    imagen_url: string | null;
                    es_vendible: boolean;
                };
            } & {
                id: number;
                fecha_creacion: Date;
                total: import("@prisma/client/runtime/library").Decimal;
                precio_unitario: import("@prisma/client/runtime/library").Decimal;
                id_producto: number;
                cantidad: import("@prisma/client/runtime/library").Decimal;
                id_orden: number;
                subtotal: import("@prisma/client/runtime/library").Decimal;
                descuento: import("@prisma/client/runtime/library").Decimal;
                notas: string | null;
            })[];
            pagos: ({
                metodo_pago: {
                    orden: number;
                    activo: boolean;
                    id: number;
                    fecha_creacion: Date;
                    nombre: string;
                    descripcion: string | null;
                    es_sistema: boolean;
                    codigo: string;
                    icono: string | null;
                    requiere_referencia: boolean;
                };
            } & {
                id: number;
                id_orden: number;
                referencia: string | null;
                notas: string | null;
                fecha_pago: Date;
                monto: import("@prisma/client/runtime/library").Decimal;
                id_metodo_pago: number;
            })[];
        } & {
            id: number;
            total: import("@prisma/client/runtime/library").Decimal;
            numero_orden: string;
            tipo_orden: import(".prisma/client").$Enums.TipoOrden;
            id_estado: number;
            id_usuario: number;
            direccion_entrega: string | null;
            telefono_contacto: string | null;
            nombre_contacto: string | null;
            notas_entrega: string | null;
            costo_domicilio: import("@prisma/client/runtime/library").Decimal | null;
            plataforma_delivery: string | null;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            descuento: import("@prisma/client/runtime/library").Decimal;
            impuestos: import("@prisma/client/runtime/library").Decimal;
            propina: import("@prisma/client/runtime/library").Decimal;
            observaciones: string | null;
            fecha_apertura: Date;
            fecha_confirmacion: Date | null;
            fecha_entrega: Date | null;
            fecha_cancelacion: Date | null;
            motivo_cancelacion: string | null;
        };
    } & {
        id: number;
        total: import("@prisma/client/runtime/library").Decimal;
        id_orden: number;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        impuestos: import("@prisma/client/runtime/library").Decimal;
        numero_factura: string;
        estado_factura: import(".prisma/client").$Enums.EstadoFactura;
        fecha_emision: Date;
        fecha_pago: Date | null;
    }>;
    obtenerPorOrden(id_orden: number): Promise<{
        orden: {
            detalles: ({
                producto: {
                    id: number;
                    estado: import(".prisma/client").$Enums.EstadoGeneral;
                    fecha_creacion: Date;
                    fecha_modificacion: Date;
                    nombre: string;
                    descripcion: string | null;
                    codigo_barras: string | null;
                    sku: string;
                    id_categoria: number | null;
                    tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                    unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                    precio_unitario: import("@prisma/client/runtime/library").Decimal;
                    precio_venta: import("@prisma/client/runtime/library").Decimal | null;
                    stock_actual: import("@prisma/client/runtime/library").Decimal;
                    stock_minimo: import("@prisma/client/runtime/library").Decimal;
                    stock_maximo: import("@prisma/client/runtime/library").Decimal | null;
                    punto_reorden: import("@prisma/client/runtime/library").Decimal | null;
                    dias_vida_util: number | null;
                    requiere_refrigeracion: boolean;
                    imagen_url: string | null;
                    es_vendible: boolean;
                };
            } & {
                id: number;
                fecha_creacion: Date;
                total: import("@prisma/client/runtime/library").Decimal;
                precio_unitario: import("@prisma/client/runtime/library").Decimal;
                id_producto: number;
                cantidad: import("@prisma/client/runtime/library").Decimal;
                id_orden: number;
                subtotal: import("@prisma/client/runtime/library").Decimal;
                descuento: import("@prisma/client/runtime/library").Decimal;
                notas: string | null;
            })[];
            pagos: ({
                metodo_pago: {
                    orden: number;
                    activo: boolean;
                    id: number;
                    fecha_creacion: Date;
                    nombre: string;
                    descripcion: string | null;
                    es_sistema: boolean;
                    codigo: string;
                    icono: string | null;
                    requiere_referencia: boolean;
                };
            } & {
                id: number;
                id_orden: number;
                referencia: string | null;
                notas: string | null;
                fecha_pago: Date;
                monto: import("@prisma/client/runtime/library").Decimal;
                id_metodo_pago: number;
            })[];
        } & {
            id: number;
            total: import("@prisma/client/runtime/library").Decimal;
            numero_orden: string;
            tipo_orden: import(".prisma/client").$Enums.TipoOrden;
            id_estado: number;
            id_usuario: number;
            direccion_entrega: string | null;
            telefono_contacto: string | null;
            nombre_contacto: string | null;
            notas_entrega: string | null;
            costo_domicilio: import("@prisma/client/runtime/library").Decimal | null;
            plataforma_delivery: string | null;
            subtotal: import("@prisma/client/runtime/library").Decimal;
            descuento: import("@prisma/client/runtime/library").Decimal;
            impuestos: import("@prisma/client/runtime/library").Decimal;
            propina: import("@prisma/client/runtime/library").Decimal;
            observaciones: string | null;
            fecha_apertura: Date;
            fecha_confirmacion: Date | null;
            fecha_entrega: Date | null;
            fecha_cancelacion: Date | null;
            motivo_cancelacion: string | null;
        };
    } & {
        id: number;
        total: import("@prisma/client/runtime/library").Decimal;
        id_orden: number;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        impuestos: import("@prisma/client/runtime/library").Decimal;
        numero_factura: string;
        estado_factura: import(".prisma/client").$Enums.EstadoFactura;
        fecha_emision: Date;
        fecha_pago: Date | null;
    }>;
    /**
     * generarDesdeOrden — crea la factura automáticamente
     *
     * Recibe `tx` (transacción de Prisma) para ejecutarse en el mismo
     * bloque atómico que el cambio de estado EN_PREPARACION.
     * Si `tx` no se pasa, crea su propia transacción (para llamadas directas).
     *
     * Número generado secuencialmente: FAC-000001, FAC-000002...
     */
    generarDesdeOrden(id_orden: number, tx?: any): Promise<any>;
};
//# sourceMappingURL=factura.service.d.ts.map