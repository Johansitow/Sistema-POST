/**
 * Servicio de Órdenes
 * Adaptado al schema real de Prisma
 */
import { TipoOrden } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
export interface OrdenDetalleInput {
    id_producto: number;
    cantidad: number;
    precio_unitario: number;
    descuento?: number;
    notas?: string;
}
export interface OrdenCreateInput {
    tipo_orden: TipoOrden;
    id_estado: number;
    id_usuario: number;
    direccion_entrega?: string;
    telefono_contacto?: string;
    nombre_contacto?: string;
    notas_entrega?: string;
    costo_domicilio?: number;
    plataforma_delivery?: string;
    descuento?: number;
    propina?: number;
    observaciones?: string;
    detalles: OrdenDetalleInput[];
}
export interface OrdenUpdateInput {
    id_estado?: number;
    direccion_entrega?: string;
    telefono_contacto?: string;
    nombre_contacto?: string;
    notas_entrega?: string;
    costo_domicilio?: number;
    plataforma_delivery?: string;
    descuento?: number;
    propina?: number;
    observaciones?: string;
}
export interface OrdenesFilter {
    tipo_orden?: TipoOrden;
    id_estado?: number;
    fecha_desde?: Date;
    fecha_hasta?: Date;
    page?: number;
    limit?: number;
}
export declare class OrdenesService {
    findAll(filter?: OrdenesFilter): Promise<({
        estado: {
            activo: boolean;
            nombre: string;
            id: number;
            descripcion: string | null;
            fecha_creacion: Date;
            orden: number;
            codigo: string;
            color: string | null;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
            es_sistema: boolean;
        };
        usuario: {
            id: number;
            nombre_completo: string;
            email: string;
        };
        detalles: ({
            producto: {
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                sku: string;
                nombre: string;
                id: number;
                codigo_barras: string | null;
                descripcion: string | null;
                id_categoria: number | null;
                tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                precio_unitario: Decimal;
                precio_venta: Decimal | null;
                stock_actual: Decimal;
                stock_minimo: Decimal;
                stock_maximo: Decimal | null;
                punto_reorden: Decimal | null;
                dias_vida_util: number | null;
                requiere_refrigeracion: boolean;
                imagen_url: string | null;
                es_vendible: boolean;
                fecha_creacion: Date;
                fecha_modificacion: Date;
            };
        } & {
            id: number;
            precio_unitario: Decimal;
            fecha_creacion: Date;
            total: Decimal;
            cantidad: Decimal;
            id_orden: number;
            id_producto: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
        numero_orden: string;
        id_usuario: number;
        direccion_entrega: string | null;
        telefono_contacto: string | null;
        nombre_contacto: string | null;
        notas_entrega: string | null;
        costo_domicilio: Decimal | null;
        plataforma_delivery: string | null;
        subtotal: Decimal;
        descuento: Decimal;
        impuestos: Decimal;
        propina: Decimal;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_confirmacion: Date | null;
        fecha_entrega: Date | null;
        fecha_cancelacion: Date | null;
        motivo_cancelacion: string | null;
    })[]>;
    findById(id: number): Promise<({
        estado: {
            activo: boolean;
            nombre: string;
            id: number;
            descripcion: string | null;
            fecha_creacion: Date;
            orden: number;
            codigo: string;
            color: string | null;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
            es_sistema: boolean;
        };
        usuario: {
            id: number;
            nombre_completo: string;
            email: string;
        };
        detalles: ({
            producto: {
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                sku: string;
                nombre: string;
                id: number;
                codigo_barras: string | null;
                descripcion: string | null;
                id_categoria: number | null;
                tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                precio_unitario: Decimal;
                precio_venta: Decimal | null;
                stock_actual: Decimal;
                stock_minimo: Decimal;
                stock_maximo: Decimal | null;
                punto_reorden: Decimal | null;
                dias_vida_util: number | null;
                requiere_refrigeracion: boolean;
                imagen_url: string | null;
                es_vendible: boolean;
                fecha_creacion: Date;
                fecha_modificacion: Date;
            };
        } & {
            id: number;
            precio_unitario: Decimal;
            fecha_creacion: Date;
            total: Decimal;
            cantidad: Decimal;
            id_orden: number;
            id_producto: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
        pagos: ({
            metodo_pago: {
                activo: boolean;
                nombre: string;
                id: number;
                descripcion: string | null;
                fecha_creacion: Date;
                orden: number;
                codigo: string;
                icono: string | null;
                es_sistema: boolean;
                requiere_referencia: boolean;
            };
        } & {
            id: number;
            id_orden: number;
            referencia: string | null;
            notas: string | null;
            id_metodo_pago: number;
            monto: Decimal;
            fecha_pago: Date;
        })[];
    } & {
        id: number;
        total: Decimal;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
        numero_orden: string;
        id_usuario: number;
        direccion_entrega: string | null;
        telefono_contacto: string | null;
        nombre_contacto: string | null;
        notas_entrega: string | null;
        costo_domicilio: Decimal | null;
        plataforma_delivery: string | null;
        subtotal: Decimal;
        descuento: Decimal;
        impuestos: Decimal;
        propina: Decimal;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_confirmacion: Date | null;
        fecha_entrega: Date | null;
        fecha_cancelacion: Date | null;
        motivo_cancelacion: string | null;
    }) | null>;
    create(data: OrdenCreateInput): Promise<{
        estado: {
            activo: boolean;
            nombre: string;
            id: number;
            descripcion: string | null;
            fecha_creacion: Date;
            orden: number;
            codigo: string;
            color: string | null;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
            es_sistema: boolean;
        };
        detalles: ({
            producto: {
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                sku: string;
                nombre: string;
                id: number;
                codigo_barras: string | null;
                descripcion: string | null;
                id_categoria: number | null;
                tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                precio_unitario: Decimal;
                precio_venta: Decimal | null;
                stock_actual: Decimal;
                stock_minimo: Decimal;
                stock_maximo: Decimal | null;
                punto_reorden: Decimal | null;
                dias_vida_util: number | null;
                requiere_refrigeracion: boolean;
                imagen_url: string | null;
                es_vendible: boolean;
                fecha_creacion: Date;
                fecha_modificacion: Date;
            };
        } & {
            id: number;
            precio_unitario: Decimal;
            fecha_creacion: Date;
            total: Decimal;
            cantidad: Decimal;
            id_orden: number;
            id_producto: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
        numero_orden: string;
        id_usuario: number;
        direccion_entrega: string | null;
        telefono_contacto: string | null;
        nombre_contacto: string | null;
        notas_entrega: string | null;
        costo_domicilio: Decimal | null;
        plataforma_delivery: string | null;
        subtotal: Decimal;
        descuento: Decimal;
        impuestos: Decimal;
        propina: Decimal;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_confirmacion: Date | null;
        fecha_entrega: Date | null;
        fecha_cancelacion: Date | null;
        motivo_cancelacion: string | null;
    }>;
    update(id: number, data: OrdenUpdateInput): Promise<{
        estado: {
            activo: boolean;
            nombre: string;
            id: number;
            descripcion: string | null;
            fecha_creacion: Date;
            orden: number;
            codigo: string;
            color: string | null;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
            es_sistema: boolean;
        };
        detalles: ({
            producto: {
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                sku: string;
                nombre: string;
                id: number;
                codigo_barras: string | null;
                descripcion: string | null;
                id_categoria: number | null;
                tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                precio_unitario: Decimal;
                precio_venta: Decimal | null;
                stock_actual: Decimal;
                stock_minimo: Decimal;
                stock_maximo: Decimal | null;
                punto_reorden: Decimal | null;
                dias_vida_util: number | null;
                requiere_refrigeracion: boolean;
                imagen_url: string | null;
                es_vendible: boolean;
                fecha_creacion: Date;
                fecha_modificacion: Date;
            };
        } & {
            id: number;
            precio_unitario: Decimal;
            fecha_creacion: Date;
            total: Decimal;
            cantidad: Decimal;
            id_orden: number;
            id_producto: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
        numero_orden: string;
        id_usuario: number;
        direccion_entrega: string | null;
        telefono_contacto: string | null;
        nombre_contacto: string | null;
        notas_entrega: string | null;
        costo_domicilio: Decimal | null;
        plataforma_delivery: string | null;
        subtotal: Decimal;
        descuento: Decimal;
        impuestos: Decimal;
        propina: Decimal;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_confirmacion: Date | null;
        fecha_entrega: Date | null;
        fecha_cancelacion: Date | null;
        motivo_cancelacion: string | null;
    }>;
    updateEstado(id: number, idEstado: number): Promise<{
        estado: {
            activo: boolean;
            nombre: string;
            id: number;
            descripcion: string | null;
            fecha_creacion: Date;
            orden: number;
            codigo: string;
            color: string | null;
            icono: string | null;
            es_inicial: boolean;
            es_final: boolean;
            permite_edicion: boolean;
            imprime_comanda: boolean;
            es_sistema: boolean;
        };
        detalles: ({
            producto: {
                estado: import(".prisma/client").$Enums.EstadoGeneral;
                sku: string;
                nombre: string;
                id: number;
                codigo_barras: string | null;
                descripcion: string | null;
                id_categoria: number | null;
                tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                precio_unitario: Decimal;
                precio_venta: Decimal | null;
                stock_actual: Decimal;
                stock_minimo: Decimal;
                stock_maximo: Decimal | null;
                punto_reorden: Decimal | null;
                dias_vida_util: number | null;
                requiere_refrigeracion: boolean;
                imagen_url: string | null;
                es_vendible: boolean;
                fecha_creacion: Date;
                fecha_modificacion: Date;
            };
        } & {
            id: number;
            precio_unitario: Decimal;
            fecha_creacion: Date;
            total: Decimal;
            cantidad: Decimal;
            id_orden: number;
            id_producto: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
        numero_orden: string;
        id_usuario: number;
        direccion_entrega: string | null;
        telefono_contacto: string | null;
        nombre_contacto: string | null;
        notas_entrega: string | null;
        costo_domicilio: Decimal | null;
        plataforma_delivery: string | null;
        subtotal: Decimal;
        descuento: Decimal;
        impuestos: Decimal;
        propina: Decimal;
        observaciones: string | null;
        fecha_apertura: Date;
        fecha_confirmacion: Date | null;
        fecha_entrega: Date | null;
        fecha_cancelacion: Date | null;
        motivo_cancelacion: string | null;
    }>;
    delete(id: number): Promise<void>;
    addDetalle(ordenId: number, data: OrdenDetalleInput): Promise<{
        producto: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            sku: string;
            nombre: string;
            id: number;
            codigo_barras: string | null;
            descripcion: string | null;
            id_categoria: number | null;
            tipo_materia: import(".prisma/client").$Enums.TipoMateria;
            unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
            precio_unitario: Decimal;
            precio_venta: Decimal | null;
            stock_actual: Decimal;
            stock_minimo: Decimal;
            stock_maximo: Decimal | null;
            punto_reorden: Decimal | null;
            dias_vida_util: number | null;
            requiere_refrigeracion: boolean;
            imagen_url: string | null;
            es_vendible: boolean;
            fecha_creacion: Date;
            fecha_modificacion: Date;
        };
    } & {
        id: number;
        precio_unitario: Decimal;
        fecha_creacion: Date;
        total: Decimal;
        cantidad: Decimal;
        id_orden: number;
        id_producto: number;
        subtotal: Decimal;
        descuento: Decimal;
        notas: string | null;
    }>;
    updateDetalle(detalleId: number, data: {
        cantidad?: number;
        notas?: string;
    }): Promise<{
        producto: {
            estado: import(".prisma/client").$Enums.EstadoGeneral;
            sku: string;
            nombre: string;
            id: number;
            codigo_barras: string | null;
            descripcion: string | null;
            id_categoria: number | null;
            tipo_materia: import(".prisma/client").$Enums.TipoMateria;
            unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
            precio_unitario: Decimal;
            precio_venta: Decimal | null;
            stock_actual: Decimal;
            stock_minimo: Decimal;
            stock_maximo: Decimal | null;
            punto_reorden: Decimal | null;
            dias_vida_util: number | null;
            requiere_refrigeracion: boolean;
            imagen_url: string | null;
            es_vendible: boolean;
            fecha_creacion: Date;
            fecha_modificacion: Date;
        };
    } & {
        id: number;
        precio_unitario: Decimal;
        fecha_creacion: Date;
        total: Decimal;
        cantidad: Decimal;
        id_orden: number;
        id_producto: number;
        subtotal: Decimal;
        descuento: Decimal;
        notas: string | null;
    }>;
    removeDetalle(detalleId: number): Promise<void>;
    private recalcularTotales;
    getEstadisticas(filter?: {
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<{
        total: number;
        porEstado: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.OrdenGroupByOutputType, "id_estado"[]> & {
            _count: number;
        })[];
        porTipo: (import(".prisma/client").Prisma.PickEnumerable<import(".prisma/client").Prisma.OrdenGroupByOutputType, "tipo_orden"[]> & {
            _count: number;
        })[];
        ventasTotales: number;
        promedioVenta: number;
    }>;
}
//# sourceMappingURL=ordenes.service.d.ts.map