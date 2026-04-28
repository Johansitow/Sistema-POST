/**
 * OrdenService - Solo lógica de negocio para órdenes
 *
 * Cambios respecto a la versión anterior:
 * 1. actualizarEstado() valida la transición contra BD antes de aplicarla
 * 2. Al pasar a EN_PREPARACION se genera la factura automáticamente
 * 3. Al pasar a ENTREGADA se registran los pagos y se cierra la factura
 * 4. [NUEVO] Al pasar a ENTREGADA se verifica stock de ingredientes por receta
 * 5. [NUEVO] Al pasar a ENTREGADA se descuentan ingredientes del inventario
 */
import { TipoOrden } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
export declare const ordenService: {
    listar(params: {
        page?: unknown;
        limit?: unknown;
        tipo_orden?: TipoOrden;
        id_estado?: number;
        fecha_desde?: Date;
        fecha_hasta?: Date;
    }): Promise<import("../lib/pagination").PaginatedResult<{
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
    }>>;
    obtenerPorId(id: number): Promise<{
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
    }>;
    crear(data: any): Promise<{
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
    }>;
    actualizar(id: number, data: any): Promise<{
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
    }>;
    /**
     * actualizarEstado — cambia el estado de una orden con validación de flujo
     *
     * Flujo completo:
     * 1. Verifica que la orden existe
     * 2. Valida que la transición desde→hacia está permitida en BD
     * 3. Si el nuevo estado es EN_PREPARACION → genera factura automáticamente
     * 4. Si el nuevo estado es ENTREGADA:
     *    a) [NUEVO] Verifica stock de ingredientes por receta (antes de la tx)
     *    b) Registra pagos y cierra la factura
     *    c) [NUEVO] Descuenta ingredientes del inventario (dentro de la tx)
     * 5. Actualiza el estado de la orden
     *
     * pagos es requerido solo cuando el nuevo estado es ENTREGADA.
     * El frontend debe mostrar la ventanilla de pago antes de llamar este endpoint.
     */
    actualizarEstado(id: number, id_estado_nuevo: number, pagos?: Array<{
        id_metodo_pago: number;
        monto: number;
        referencia?: string;
        notas?: string;
    }>): Promise<{
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
    }>;
    eliminar(id: number): Promise<void>;
    agregarDetalle(ordenId: number, data: any): Promise<{
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
    }>;
    actualizarDetalle(detalleId: number, data: {
        cantidad?: number;
        notas?: string;
    }): Promise<{
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
    }>;
    eliminarDetalle(detalleId: number): Promise<void>;
    estadisticas(params: {
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
    _recalcularTotales(tx: any, ordenId: number): Promise<void>;
};
//# sourceMappingURL=orden.service.d.ts.map