"use strict";
/**
 * EstadoService - Lógica de negocio para estados de orden y transiciones
 *
 * La responsabilidad principal es validarTransicion(),
 * que es llamada por orden.service antes de cada cambio de estado.
 * El resto son operaciones de configuración para el superadmin.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.estadoService = void 0;
const estado_repository_1 = require("../repositories/estado.repository");
const HttpErrors_1 = require("../exceptions/HttpErrors");
exports.estadoService = {
    async listar() {
        return estado_repository_1.estadoRepository.findAll();
    },
    async obtenerPorId(id) {
        const estado = await estado_repository_1.estadoRepository.findById(id);
        if (!estado)
            throw new HttpErrors_1.NotFoundError('Estado de orden');
        return estado;
    },
    async actualizar(id, data) {
        await this.obtenerPorId(id);
        return estado_repository_1.estadoRepository.update(id, data);
    },
    // ─── Transiciones ────────────────────────────────────────────────────────────
    /**
     * validarTransicion — núcleo de la validación de flujo de órdenes
     *
     * Lanza BadRequestError si:
     * - El estado destino no existe
     * - La transición desde→hacia no está registrada en BD
     *
     * orden.service llama esto antes de cada updateEstado.
     * Al ser dinámico, el admin puede agregar o quitar transiciones
     * desde el frontend sin tocar código.
     */
    async validarTransicion(id_estado_actual, id_estado_nuevo) {
        const transicion = await estado_repository_1.estadoRepository.findTransicion(id_estado_actual, id_estado_nuevo);
        if (!transicion) {
            const [desde, hacia] = await Promise.all([
                estado_repository_1.estadoRepository.findById(id_estado_actual),
                estado_repository_1.estadoRepository.findById(id_estado_nuevo),
            ]);
            throw new HttpErrors_1.BadRequestError(`Transición no permitida: "${desde?.nombre ?? id_estado_actual}" → "${hacia?.nombre ?? id_estado_nuevo}"`);
        }
    },
    async listarTransiciones(id_estado) {
        await this.obtenerPorId(id_estado);
        return estado_repository_1.estadoRepository.findTransicionesByEstado(id_estado);
    },
    async agregarTransicion(data) {
        // Verificar que ambos estados existen
        const [desde, hacia] = await Promise.all([
            estado_repository_1.estadoRepository.findById(data.id_estado_desde),
            estado_repository_1.estadoRepository.findById(data.id_estado_hacia),
        ]);
        if (!desde)
            throw new HttpErrors_1.NotFoundError('Estado origen');
        if (!hacia)
            throw new HttpErrors_1.NotFoundError('Estado destino');
        // No permitir transiciones desde estados finales
        if (desde.es_final) {
            throw new HttpErrors_1.BadRequestError(`"${desde.nombre}" es un estado final, no puede tener transiciones de salida`);
        }
        // Verificar que no existe ya
        const existe = await estado_repository_1.estadoRepository.findTransicion(data.id_estado_desde, data.id_estado_hacia);
        if (existe)
            throw new HttpErrors_1.ConflictError('Esa transición ya existe');
        return estado_repository_1.estadoRepository.createTransicion(data);
    },
    async eliminarTransicion(id) {
        const transicion = await estado_repository_1.estadoRepository.findTransicionById(id);
        if (!transicion)
            throw new HttpErrors_1.NotFoundError('Transición');
        return estado_repository_1.estadoRepository.deleteTransicion(id);
    },
};
//# sourceMappingURL=estado.service.js.map