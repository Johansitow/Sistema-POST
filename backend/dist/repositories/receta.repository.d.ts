/**
 * RecetaRepository
 */
export declare const recetaRepository: {
    findAll: (params: {
        skip: number;
        take: number;
        id_producto?: number;
        estado?: string;
    }) => Promise<[({
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
    })[], number]>;
    findById: (id: number) => import(".prisma/client").Prisma.Prisma__RecetaClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByProductoFinal: (id_producto: number) => import(".prisma/client").Prisma.Prisma__RecetaClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create: (data: {
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
    }) => import(".prisma/client").Prisma.Prisma__RecetaClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update: (id: number, data: Partial<{
        nombre_receta: string;
        descripcion: string;
        cantidad_producida: number;
        unidad_produccion: string;
        tiempo_preparacion: number;
        instrucciones: string;
        notas: string;
        merma_esperada_porcentaje: number;
        estado: string;
    }>) => import(".prisma/client").Prisma.Prisma__RecetaClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    reemplazarIngredientes: (id_receta: number, ingredientes: {
        id_producto: number;
        cantidad: number;
        unidad: string;
        es_opcional?: boolean;
        notas?: string;
        orden?: number;
    }[]) => Promise<({
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
    }) | null>;
};
//# sourceMappingURL=receta.repository.d.ts.map