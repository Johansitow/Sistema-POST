/**
 * OrdenRepository - Solo queries Prisma para órdenes
 */
import { TipoOrden } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PaginationParams } from '../lib/pagination';
export declare const ordenRepository: {
    findAll: (pagination: PaginationParams, filters: {
        tipo_orden?: TipoOrden;
        id_estado?: number;
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }) => Promise<[({
        usuario: {
            id: number;
            nombre_completo: string;
            email: string;
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
            };
        } & {
            id: number;
            fecha_creacion: Date;
            total: Decimal;
            precio_unitario: Decimal;
            id_producto: number;
            cantidad: Decimal;
            id_orden: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    })[], number]>;
    findById: (id: number) => import(".prisma/client").Prisma.Prisma__OrdenClient<({
        usuario: {
            id: number;
            nombre_completo: string;
            email: string;
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
            };
        } & {
            id: number;
            fecha_creacion: Date;
            total: Decimal;
            precio_unitario: Decimal;
            id_producto: number;
            cantidad: Decimal;
            id_orden: number;
            subtotal: Decimal;
            descuento: Decimal;
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
            monto: Decimal;
            id_metodo_pago: number;
        })[];
    } & {
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findUltima: () => import(".prisma/client").Prisma.Prisma__OrdenClient<{
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: any) => import(".prisma/client").Prisma.Prisma__OrdenClient<{
        usuario: {
            id: number;
            nombre_completo: string;
            email: string;
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
            };
        } & {
            id: number;
            fecha_creacion: Date;
            total: Decimal;
            precio_unitario: Decimal;
            id_producto: number;
            cantidad: Decimal;
            id_orden: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: any) => import(".prisma/client").Prisma.Prisma__OrdenClient<{
        usuario: {
            id: number;
            nombre_completo: string;
            email: string;
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
            };
        } & {
            id: number;
            fecha_creacion: Date;
            total: Decimal;
            precio_unitario: Decimal;
            id_producto: number;
            cantidad: Decimal;
            id_orden: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateEstado: (id: number, id_estado: number) => import(".prisma/client").Prisma.Prisma__OrdenClient<{
        usuario: {
            id: number;
            nombre_completo: string;
            email: string;
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
            };
        } & {
            id: number;
            fecha_creacion: Date;
            total: Decimal;
            precio_unitario: Decimal;
            id_producto: number;
            cantidad: Decimal;
            id_orden: number;
            subtotal: Decimal;
            descuento: Decimal;
            notas: string | null;
        })[];
    } & {
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateTotales: (id: number, data: {
        subtotal: Decimal;
        impuestos: Decimal;
        total: Decimal;
    }) => import(".prisma/client").Prisma.Prisma__OrdenClient<{
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    delete: (id: number) => import(".prisma/client").Prisma.Prisma__OrdenClient<{
        id: number;
        total: Decimal;
        numero_orden: string;
        tipo_orden: import(".prisma/client").$Enums.TipoOrden;
        id_estado: number;
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findDetalleById: (id: number) => import(".prisma/client").Prisma.Prisma__OrdenDetalleClient<({
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
        };
    } & {
        id: number;
        fecha_creacion: Date;
        total: Decimal;
        precio_unitario: Decimal;
        id_producto: number;
        cantidad: Decimal;
        id_orden: number;
        subtotal: Decimal;
        descuento: Decimal;
        notas: string | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findDetallesByOrden: (id_orden: number) => import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        fecha_creacion: Date;
        total: Decimal;
        precio_unitario: Decimal;
        id_producto: number;
        cantidad: Decimal;
        id_orden: number;
        subtotal: Decimal;
        descuento: Decimal;
        notas: string | null;
    }[]>;
    createDetalle: (data: any) => import(".prisma/client").Prisma.Prisma__OrdenDetalleClient<{
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
        };
    } & {
        id: number;
        fecha_creacion: Date;
        total: Decimal;
        precio_unitario: Decimal;
        id_producto: number;
        cantidad: Decimal;
        id_orden: number;
        subtotal: Decimal;
        descuento: Decimal;
        notas: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateDetalle: (id: number, data: any) => import(".prisma/client").Prisma.Prisma__OrdenDetalleClient<{
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
        };
    } & {
        id: number;
        fecha_creacion: Date;
        total: Decimal;
        precio_unitario: Decimal;
        id_producto: number;
        cantidad: Decimal;
        id_orden: number;
        subtotal: Decimal;
        descuento: Decimal;
        notas: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    deleteDetalle: (id: number) => import(".prisma/client").Prisma.Prisma__OrdenDetalleClient<{
        id: number;
        fecha_creacion: Date;
        total: Decimal;
        precio_unitario: Decimal;
        id_producto: number;
        cantidad: Decimal;
        id_orden: number;
        subtotal: Decimal;
        descuento: Decimal;
        notas: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    deleteDetallesByOrden: (id_orden: number) => import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.BatchPayload>;
    count: (where: any) => import(".prisma/client").Prisma.PrismaPromise<number>;
    aggregate: (where: any) => import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.GetOrdenAggregateType<{
        where: any;
        _sum: {
            total: true;
        };
        _avg: {
            total: true;
        };
    }>>;
    groupByEstado: (where: any) => import(".prisma/client").Prisma.GetOrdenGroupByPayload<{
        by: "id_estado"[];
        where: any;
        _count: true;
    }>;
    groupByTipo: (where: any) => import(".prisma/client").Prisma.GetOrdenGroupByPayload<{
        by: "tipo_orden"[];
        where: any;
        _count: true;
    }>;
    groupByFecha: (where: any) => import(".prisma/client").Prisma.GetOrdenGroupByPayload<{
        by: ("tipo_orden" | "fecha_apertura")[];
        where: any;
        _sum: {
            total: true;
        };
        _count: true;
        orderBy: {
            fecha_apertura: "asc";
        };
    }>;
    countHoy: (gte: Date, lt: Date) => import(".prisma/client").Prisma.PrismaPromise<number>;
    aggregateVentasHoy: (id_estado: number, gte: Date, lt: Date) => import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.GetOrdenAggregateType<{
        where: {
            id_estado: number;
            fecha_apertura: {
                gte: Date;
                lt: Date;
            };
        };
        _sum: {
            total: true;
        };
    }>>;
    groupByFechaSemana: (id_estado: number, gte: Date) => import(".prisma/client").Prisma.GetOrdenGroupByPayload<{
        by: "fecha_apertura"[];
        where: {
            id_estado: number;
            fecha_apertura: {
                gte: Date;
            };
        };
        _sum: {
            total: true;
        };
        orderBy: {
            fecha_apertura: "asc";
        };
    }>;
    topProductos: (id_estado: number, take: number) => import(".prisma/client").Prisma.GetOrdenDetalleGroupByPayload<{
        by: "id_producto"[];
        where: {
            orden: {
                id_estado: number;
            };
        };
        _sum: {
            cantidad: true;
            subtotal: true;
        };
        orderBy: {
            _sum: {
                cantidad: "desc";
            };
        };
        take: number;
    }>;
};
//# sourceMappingURL=orden.repository.d.ts.map