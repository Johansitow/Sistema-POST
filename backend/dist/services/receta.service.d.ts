/**
 * RecetaService
 */
export declare const recetaService: {
    listar(params: {
        page?: unknown;
        limit?: unknown;
        id_producto?: number;
        estado?: string;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        rentabilidad: {
            costo_ingredientes: number;
            costo_con_merma: number;
            costo_unitario: number;
            precio_sugerido_minimo: number;
            precio_actual: number;
            margen_actual_porcentaje: number;
            es_rentable: boolean;
            diferencia_precio: number;
            alerta_rentabilidad: string | null;
        };
        producto_final: {
            id: number;
            nombre: string;
            sku: string;
            unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
            precio_unitario: import("@prisma/client/runtime/library").Decimal;
            precio_venta: import("@prisma/client/runtime/library").Decimal | null;
        };
        ingredientes: ({
            producto: {
                id: number;
                nombre: string;
                sku: string;
                tipo_materia: import(".prisma/client").$Enums.TipoMateria;
                unidad_medida: import(".prisma/client").$Enums.UnidadMedida;
                precio_unitario: import("@prisma/client/runtime/library").Decimal;
                stock_actual: import("@prisma/client/runtime/library").Decimal;
            };
        } & {
            orden: number;
            id: number;
            unidad: import(".prisma/client").$Enums.UnidadMedida;
            id_producto: number;
            cantidad: import("@prisma/client/runtime/library").Decimal;
            notas: string | null;
            es_opcional: boolean;
            id_receta: number;
        })[];
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        notas: string | null;
        id_producto_final: number;
        nombre_receta: string;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        unidad_produccion: import(".prisma/client").$Enums.UnidadMedida;
        tiempo_preparacion: number | null;
        instrucciones: string | null;
        merma_esperada_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
        merma_maxima_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
    }>>;
    obtenerPorId(id: number): Promise<{
        rentabilidad: {
            costo_ingredientes: number;
            costo_con_merma: number;
            costo_unitario: number;
            precio_sugerido_minimo: number;
            precio_actual: number;
            margen_actual_porcentaje: number;
            es_rentable: boolean;
            diferencia_precio: number;
            alerta_rentabilidad: string | null;
        };
        producto_final: {
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
        ingredientes: ({
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
            orden: number;
            id: number;
            unidad: import(".prisma/client").$Enums.UnidadMedida;
            id_producto: number;
            cantidad: import("@prisma/client/runtime/library").Decimal;
            notas: string | null;
            es_opcional: boolean;
            id_receta: number;
        })[];
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        notas: string | null;
        id_producto_final: number;
        nombre_receta: string;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        unidad_produccion: import(".prisma/client").$Enums.UnidadMedida;
        tiempo_preparacion: number | null;
        instrucciones: string | null;
        merma_esperada_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
        merma_maxima_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    obtenerPorProducto(id_producto: number): Promise<{
        rentabilidad: {
            costo_ingredientes: number;
            costo_con_merma: number;
            costo_unitario: number;
            precio_sugerido_minimo: number;
            precio_actual: number;
            margen_actual_porcentaje: number;
            es_rentable: boolean;
            diferencia_precio: number;
            alerta_rentabilidad: string | null;
        };
        ingredientes: ({
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
            orden: number;
            id: number;
            unidad: import(".prisma/client").$Enums.UnidadMedida;
            id_producto: number;
            cantidad: import("@prisma/client/runtime/library").Decimal;
            notas: string | null;
            es_opcional: boolean;
            id_receta: number;
        })[];
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        notas: string | null;
        id_producto_final: number;
        nombre_receta: string;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        unidad_produccion: import(".prisma/client").$Enums.UnidadMedida;
        tiempo_preparacion: number | null;
        instrucciones: string | null;
        merma_esperada_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
        merma_maxima_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    crear(data: {
        id_producto_final: number;
        nombre_receta: string;
        descripcion?: string;
        cantidad_producida: number;
        unidad_produccion: string;
        tiempo_preparacion?: number;
        instrucciones?: string;
        notas?: string;
        merma_esperada_porcentaje?: number;
        ingredientes: {
            id_producto: number;
            cantidad: number;
            unidad: string;
            es_opcional?: boolean;
            notas?: string;
            orden?: number;
        }[];
    }): Promise<{
        rentabilidad: {
            costo_ingredientes: number;
            costo_con_merma: number;
            costo_unitario: number;
            precio_sugerido_minimo: number;
            precio_actual: number;
            margen_actual_porcentaje: number;
            es_rentable: boolean;
            diferencia_precio: number;
            alerta_rentabilidad: string | null;
        };
        producto_final: {
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
        ingredientes: ({
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
            orden: number;
            id: number;
            unidad: import(".prisma/client").$Enums.UnidadMedida;
            id_producto: number;
            cantidad: import("@prisma/client/runtime/library").Decimal;
            notas: string | null;
            es_opcional: boolean;
            id_receta: number;
        })[];
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        notas: string | null;
        id_producto_final: number;
        nombre_receta: string;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        unidad_produccion: import(".prisma/client").$Enums.UnidadMedida;
        tiempo_preparacion: number | null;
        instrucciones: string | null;
        merma_esperada_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
        merma_maxima_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    actualizar(id: number, data: any): Promise<{
        producto_final: {
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
        ingredientes: ({
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
            orden: number;
            id: number;
            unidad: import(".prisma/client").$Enums.UnidadMedida;
            id_producto: number;
            cantidad: import("@prisma/client/runtime/library").Decimal;
            notas: string | null;
            es_opcional: boolean;
            id_receta: number;
        })[];
    } & {
        id: number;
        estado: import(".prisma/client").$Enums.EstadoGeneral;
        fecha_creacion: Date;
        fecha_modificacion: Date;
        descripcion: string | null;
        notas: string | null;
        id_producto_final: number;
        nombre_receta: string;
        cantidad_producida: import("@prisma/client/runtime/library").Decimal;
        unidad_produccion: import(".prisma/client").$Enums.UnidadMedida;
        tiempo_preparacion: number | null;
        instrucciones: string | null;
        merma_esperada_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
        merma_maxima_porcentaje: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    actualizarIngredientes(id: number, ingredientes: any[]): Promise<{
        rentabilidad: {
            costo_ingredientes: number;
            costo_con_merma: number;
            costo_unitario: number;
            precio_sugerido_minimo: number;
            precio_actual: number;
            margen_actual_porcentaje: number;
            es_rentable: boolean;
            diferencia_precio: number;
            alerta_rentabilidad: string | null;
        };
        ingredientes?: ({
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
            orden: number;
            id: number;
            unidad: import(".prisma/client").$Enums.UnidadMedida;
            id_producto: number;
            cantidad: import("@prisma/client/runtime/library").Decimal;
            notas: string | null;
            es_opcional: boolean;
            id_receta: number;
        })[] | undefined;
        id?: number | undefined;
        estado?: import(".prisma/client").$Enums.EstadoGeneral | undefined;
        fecha_creacion?: Date | undefined;
        fecha_modificacion?: Date | undefined;
        descripcion?: string | null | undefined;
        notas?: string | null | undefined;
        id_producto_final?: number | undefined;
        nombre_receta?: string | undefined;
        cantidad_producida?: import("@prisma/client/runtime/library").Decimal | undefined;
        unidad_produccion?: import(".prisma/client").$Enums.UnidadMedida | undefined;
        tiempo_preparacion?: number | null | undefined;
        instrucciones?: string | null | undefined;
        merma_esperada_porcentaje?: import("@prisma/client/runtime/library").Decimal | null | undefined;
        merma_maxima_porcentaje?: import("@prisma/client/runtime/library").Decimal | null | undefined;
    }>;
    _calcularRentabilidad(receta: {
        ingredientes: {
            cantidad: number;
            producto: {
                precio_unitario: number;
            };
        }[];
        merma_esperada_porcentaje?: number | null;
        cantidad_producida: number;
        producto_final: {
            precio_venta?: number | null;
            precio_unitario: number;
        };
    }): {
        costo_ingredientes: number;
        costo_con_merma: number;
        costo_unitario: number;
        precio_sugerido_minimo: number;
        precio_actual: number;
        margen_actual_porcentaje: number;
        es_rentable: boolean;
        diferencia_precio: number;
        alerta_rentabilidad: string | null;
    };
    verificarStockParaOrden(id_orden: number): Promise<{
        ok: boolean;
    }>;
    descontarIngredientesOrden(id_orden: number, tx: any): Promise<void>;
    _verificarIngredientes(ingredientes: {
        id_producto: number;
    }[]): Promise<{
        advertencias_ingredientes_procesados: {
            id: number;
            nombre: string;
            aviso: string;
        }[];
    }>;
};
//# sourceMappingURL=receta.service.d.ts.map