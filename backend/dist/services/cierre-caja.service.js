"use strict";
/**
 * CierreCajaService
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
function generarNumeroCierre(ultimo) {
    if (!ultimo)
        return 'CIE-000001';
    const num = parseInt(ultimo.replace('CIE-', '')) + 1;
    return `CIE-${String(num).padStart(6, '0')}`;
}
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
        // Se obtiene el turno para verificar que existe (lanza NotFoundError si no)
        await this.obtenerTurno(id);
        const tieneCierres = await database_1.default.cierreCaja.count({ where: { id_turno: id } });
        if (tieneCierres > 0)
            throw new HttpErrors_1.ConflictError('No se puede eliminar un turno con cierres registrados. Desactívalo en su lugar.');
        return turno_cierre_repository_1.turnoCajaRepository.delete(id);
    },
    // ── CIERRES ─────────────────────────────────────────────────────────────────
    async listar(params) {
        const p = (0, pagination_1.getPaginationParams)(params.page, params.limit);
        const [data, total] = await turno_cierre_repository_1.cierreCajaRepository.findAll({
            skip: (0, pagination_1.getSkip)(p),
            take: p.limit,
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
    async iniciarCierre(data) {
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
            // @ts-ignore
            { ordenes_abiertas: ordenesAbiertas });
        }
        const { totalVentas, totalEfectivo, totalesPorMetodo } = await this._calcularTotalesPeriodo(data.fecha_apertura, new Date());
        const ultimo = await turno_cierre_repository_1.cierreCajaRepository.findUltimo();
        const numeroCierre = generarNumeroCierre(ultimo?.numero_cierre ?? null);
        return turno_cierre_repository_1.cierreCajaRepository.create({
            id_usuario: data.id_usuario,
            id_turno: data.id_turno,
            numero_cierre: numeroCierre,
            fecha_apertura: data.fecha_apertura,
            monto_inicial: data.monto_inicial,
            monto_final: 0,
            totales_por_metodo: totalesPorMetodo,
            total_ventas: totalVentas,
            total_efectivo: totalEfectivo,
            diferencia: 0,
            estado: client_1.EstadoCierre.en_proceso,
        });
    },
    async confirmarCierre(id, data) {
        const cierre = await this.obtenerPorId(id);
        if (cierre.estado !== client_1.EstadoCierre.en_proceso)
            throw new HttpErrors_1.BadRequestError('Este cierre no está en estado en_proceso');
        const diferencia = data.monto_final - Number(cierre.total_ventas);
        let umbralDiferencia = 5000;
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
        const pagos = await database_1.default.pago.findMany({
            where: { fecha_pago: { gte: desde, lte: hasta } },
            include: { metodo_pago: { select: { codigo: true, nombre: true } } },
        });
        const totalVentas = pagos.reduce((s, p) => s + Number(p.monto), 0);
        const totalEfectivo = pagos
            .filter(p => p.metodo_pago.codigo === 'EFECTIVO')
            .reduce((s, p) => s + Number(p.monto), 0);
        const totalesPorMetodo = {};
        for (const pago of pagos) {
            const codigo = pago.metodo_pago.codigo;
            totalesPorMetodo[codigo] = (totalesPorMetodo[codigo] ?? 0) + Number(pago.monto);
        }
        return { totalVentas, totalEfectivo, totalesPorMetodo };
    },
};
//# sourceMappingURL=cierre-caja.service.js.map