/**
 * AlertaService - Lógica de negocio para alertas de inventario
 *
 * El método clave es sincronizar():
 * - Se llama automáticamente después de cualquier cambio de stock
 * - Compara el estado actual del producto contra las alertas existentes
 * - Crea alertas nuevas si el producto está en condición de alerta
 * - No crea duplicados: verifica si ya existe una alerta activa del mismo tipo
 *
 * El frontend consume countNoLeidas() para el badge del Layout.
 */
export declare const alertaService: {
    listarTipos(): Promise<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    }[]>;
    crearTipo(data: {
        nombre: string;
        codigo: string;
        descripcion?: string;
        icono?: string;
        color?: string;
        prioridad_default?: string;
    }): Promise<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    }>;
    actualizarTipo(id: number, data: Partial<{
        nombre: string;
        descripcion: string;
        icono: string;
        color: string;
        prioridad_default: string;
        activo: boolean;
    }>): Promise<{
        activo: boolean;
        id: number;
        fecha_creacion: Date;
        nombre: string;
        descripcion: string | null;
        es_sistema: boolean;
        color: string | null;
        codigo: string;
        icono: string | null;
        prioridad_default: string;
    }>;
    listar(params: {
        page?: unknown;
        limit?: unknown;
        es_leida?: boolean;
        nivel_prioridad?: string;
        id_tipo_alerta?: number;
    }): Promise<import("../lib/pagination").PaginatedResult<{
        producto: {
            id: number;
            nombre: string;
            sku: string;
            stock_actual: import("@prisma/client/runtime/library").Decimal;
            stock_minimo: import("@prisma/client/runtime/library").Decimal;
        } | null;
        tipo_alerta: {
            activo: boolean;
            id: number;
            fecha_creacion: Date;
            nombre: string;
            descripcion: string | null;
            es_sistema: boolean;
            color: string | null;
            codigo: string;
            icono: string | null;
            prioridad_default: string;
        };
    } & {
        id: number;
        fecha_creacion: Date;
        id_producto: number | null;
        id_tipo_alerta: number;
        mensaje: string;
        nivel_prioridad: string;
        es_leida: boolean;
        fecha_leida: Date | null;
    }>>;
    countNoLeidas(): Promise<{
        total: number;
    }>;
    marcarLeida(id: number): Promise<{
        id: number;
        fecha_creacion: Date;
        id_producto: number | null;
        id_tipo_alerta: number;
        mensaje: string;
        nivel_prioridad: string;
        es_leida: boolean;
        fecha_leida: Date | null;
    }>;
    marcarTodasLeidas(): Promise<{
        message: string;
    }>;
    /**
     * sincronizar — analiza el estado actual de todos los productos activos
     * y genera alertas en BD sin crear duplicados.
     *
     * Se llama desde:
     * - producto.service después de actualizar stock
     * - inventario.service después de registrar un movimiento
     * - Un job periódico (cron) si se implementa en el futuro
     *
     * Lógica:
     * 1. Obtiene todos los tipos de alerta activos del sistema
     * 2. Para cada producto activo verifica si cumple condición de alerta
     * 3. Si ya existe una alerta activa del mismo tipo → no crea duplicado
     * 4. Si la condición desapareció y hay alerta activa → la marca como leída
     */
    sincronizar(): Promise<{
        creadas: number;
        resueltas: number;
    }>;
    /**
     * _sincronizarVencimientos — alerta sobre lotes próximos a vencer (≤ 7 días)
     */
    _sincronizarVencimientos(tipoVencimiento: any): Promise<{
        creadas: number;
        resueltas: number;
    }>;
};
//# sourceMappingURL=alerta.service.d.ts.map