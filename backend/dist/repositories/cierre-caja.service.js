"use strict";
/**
 * CierreCajaService
 *
 * Flujo:
 * 1. Superadmin crea turnos con hora_apertura/hora_cierre
 * 2. Al llegar la hora de cierre, el frontend llama a iniciarCierre()
 * 3. El service verifica que no haya órdenes abiertas → si hay, lanza error con la lista
 * 4. Calcula totales del período desde la BD (sistema)
 * 5. El cajero declara cuánto hay físicamente → confirmarCierre()
 * 6. Si hay diferencia > umbral configurable, exige justificación
 * 7. Guarda el cierre en estado completado o con_diferencia
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cierreCajaService = void 0;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const turno_cierre_repository_1 = require("../repositories/turno-cierre.repository");
const configuracion_service_1 = require("./configuracion.service");
const HttpErrors_1 = require("../exceptions/HttpErrors");
const pagination_1 = require("../lib/pagination");
// Genera CIE-000001, CIE-000002, ...
function generarNumeroCierre(ultimo) {
    if (!ultimo)
        return 'CIE-000001';
    const num = parseInt(ultimo.replace('CIE-', '')) + 1;
    return `CIE-${String(num).padStart(6, '0')}`;
}
// ─────────────────────────────────────────────────────────────────────────────
exports.cierreCajaService = {
    // ── TURNOS ──────────────────────────────────────────────────────────────────
    async listarTurnos(soloActivos = false) {
        return turno_cierre_repository_1.turnoCajaRepository.findAll(soloActivos);
    },
    async obtenerTurno(id) {
        const t = await turno_cierre_repository_1.turnoCajaRepository.findById(id);
        if (!t)
            throw new HttpErrors_1.NotFoundError('Turno de caja');
        return t;
    },
    async crearTurno(data) {
        // Validar formato HH:MM
        const horaRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!horaRe.test(data.hora_apertura))
            throw new HttpErrors_1.BadRequestError('hora_apertura inválida (HH:MM)');
        if (!horaRe.test(data.hora_cierre))
            throw new HttpErrors_1.BadRequestError('hora_cierre inválida (HH:MM)');
        if (data.hora_apertura >= data.hora_cierre)
            throw new HttpErrors_1.BadRequestError('hora_cierre debe ser posterior a hora_apertura');
        return turno_cierre_repository_1.turnoCajaRepository.create(data);
    },
    async actualizarTurno(id, data) {
        await this.obtenerTurno(id);
        return turno_cierre_repository_1.turnoCajaRepository.update(id, data);
    },
    async eliminarTurno(id) {
        const turno = await this.obtenerTurno(id);
        const tieneCierres = await database_1.default.cierreCaja.count({ where: { id_turno: id } });
        if (tieneCierres > 0)
            throw new HttpErrors_1.ConflictError('No se puede eliminar un turno con cierres registrados. Desactívalo en su lugar.');
        return turno_cierre_repository_1.turnoCajaRepository.delete(id);
    },
    // ── CIERRES ─────────────────────────────────────────────────────────────────
    async listar(params) {
        const p = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [data, total] = await turno_cierre_repository_1.cierreCajaRepository.findAll({
            skip: p.skip, take: p.take,
            fecha_desde: params.fecha_desde,
            fecha_hasta: params.fecha_hasta,
            id_usuario: params.id_usuario,
            estado: params.estado,
        });
        return (0, pagination_1.buildPaginatedResult)(data, total, p);
    },
    async obtenerPorId(id) {
        const c = await turno_cierre_repository_1.cierreCajaRepository.findById(id);
        if (!c)
            throw new HttpErrors_1.NotFoundError('Cierre de caja');
        return c;
    },
    /**
     * iniciarCierre — llama el frontend cuando llega la hora de cierre
     * ó el superadmin lo fuerza manualmente.
     *
     * Verifica órdenes abiertas. Si existen, lanza error con la lista
     * para que el frontend pueda mostrarlas al cajero.
     */
    async iniciarCierre(data) {
        // 1. Verificar órdenes abiertas en el período
        const estadosFinales = await database_1.default.estadoOrden.findMany({
            where: { es_final: true }, select: { id: true },
        });
        const idsFinales = estadosFinales.map(e => e.id);
        const ordenesAbiertas = await database_1.default.orden.findMany({
            where: {
                fecha_apertura: { gte: data.fecha_apertura },
                id_estado: { notIn: idsFinales },
            },
            select: { id: true, numero_orden: true, total: true,
                estado: { select: { nombre: true } } },
        });
        if (ordenesAbiertas.length > 0) {
            throw new HttpErrors_1.BadRequestError(`Hay ${ordenesAbiertas.length} orden(es) abiertas que impiden el cierre`, 
            // @ts-ignore — pasamos el detalle en el campo extra
            { ordenes_abiertas: ordenesAbiertas });
        }
        // 2. Calcular totales del período desde la BD
        const { totalVentas, totalEfectivo, totalesPorMetodo } = await this._calcularTotalesPeriodo(data.fecha_apertura, new Date());
        // 3. Generar número de cierre
        const ultimo = await turno_cierre_repository_1.cierreCajaRepository.findUltimo();
        const numeroCierre = generarNumeroCierre(ultimo?.numero_cierre ?? null);
        // 4. Crear cierre en estado en_proceso (cajero aún debe confirmar montos)
        return turno_cierre_repository_1.cierreCajaRepository.create({
            id_usuario: data.id_usuario,
            id_turno: data.id_turno,
            numero_cierre: numeroCierre,
            fecha_apertura: data.fecha_apertura,
            monto_inicial: data.monto_inicial,
            monto_final: 0, // el cajero lo llena en confirmarCierre
            totales_por_metodo: totalesPorMetodo,
            total_ventas: totalVentas,
            total_efectivo: totalEfectivo,
            diferencia: 0, // se calcula en confirmarCierre
            estado: client_1.EstadoCierre.en_proceso,
        });
    },
    /**
     * confirmarCierre — el cajero declara cuánto hay físicamente
     * Si |diferencia| > umbral configurable → justificacion es obligatoria
     */
    async confirmarCierre(id, data) {
        const cierre = await this.obtenerPorId(id);
        if (cierre.estado !== client_1.EstadoCierre.en_proceso)
            throw new HttpErrors_1.BadRequestError('Este cierre no está en estado en_proceso');
        const diferencia = data.monto_final - Number(cierre.total_ventas);
        // Leer umbral de diferencia permitida desde configuración
        let umbralDiferencia = 5000; // default 5.000 COP
        try {
            umbralDiferencia = await configuracion_service_1.configuracionService.getValor('umbral_diferencia_caja');
        }
        catch { /* usa el default */ }
        if (Math.abs(diferencia) > umbralDiferencia && !data.justificacion)
            throw new HttpErrors_1.BadRequestError(`La diferencia de ${Math.abs(diferencia).toLocaleString()} supera el umbral permitido. Se requiere justificación.`);
        const estadoFinal = Math.abs(diferencia) > umbralDiferencia
            ? client_1.EstadoCierre.con_diferencia
            : client_1.EstadoCierre.completado;
        return turno_cierre_repository_1.cierreCajaRepository.update(id, {
            monto_final: data.monto_final,
            diferencia,
            justificacion: data.justificacion,
            observaciones: data.observaciones,
            estado: estadoFinal,
        });
    },
    // ── PRIVADOS ─────────────────────────────────────────────────────────────────
    async _calcularTotalesPeriodo(desde, hasta) {
        // Pagos del período (órdenes entregadas)
        const pagos = await database_1.default.pago.findMany({
            where: { fecha_pago: { gte: desde, lte: hasta } },
            include: { metodo_pago: { select: { codigo: true, nombre: true } } },
        });
        const totalVentas = pagos.reduce((s, p) => s + Number(p.monto), 0);
        const totalEfectivo = pagos
            .filter(p => p.metodo_pago.codigo === 'EFECTIVO')
            .reduce((s, p) => s + Number(p.monto), 0);
        // Agrupar por método
        const totalesPorMetodo = {};
        for (const pago of pagos) {
            const codigo = pago.metodo_pago.codigo;
            totalesPorMetodo[codigo] = (totalesPorMetodo[codigo] ?? 0) + Number(pago.monto);
        }
        return { totalVentas, totalEfectivo, totalesPorMetodo };
    },
};
//# sourceMappingURL=cierre-caja.service.js.map