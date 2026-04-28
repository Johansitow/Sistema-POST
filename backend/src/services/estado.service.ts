/**
 * EstadoService - Lógica de negocio para estados de orden y transiciones
 *
 * La responsabilidad principal es validarTransicion(),
 * que es llamada por orden.service antes de cada cambio de estado.
 * El resto son operaciones de configuración para el superadmin.
 */

import { estadoRepository } from '../repositories/estado.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../exceptions/HttpErrors';

export const estadoService = {

  async listar() {
    return estadoRepository.findAll();
  },

  async obtenerPorId(id: number) {
    const estado = await estadoRepository.findById(id);
    if (!estado) throw new NotFoundError('Estado de orden');
    return estado;
  },

  async actualizar(id: number, data: Partial<{
    nombre:          string;
    descripcion:     string;
    color:           string;
    icono:           string;
    orden:           number;
    imprime_comanda: boolean;
    permite_edicion: boolean;
  }>) {
    await this.obtenerPorId(id);
    return estadoRepository.update(id, data);
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
  async validarTransicion(id_estado_actual: number, id_estado_nuevo: number): Promise<void> {
    const transicion = await estadoRepository.findTransicion(id_estado_actual, id_estado_nuevo);
    if (!transicion) {
      const [desde, hacia] = await Promise.all([
        estadoRepository.findById(id_estado_actual),
        estadoRepository.findById(id_estado_nuevo),
      ]);
      throw new BadRequestError(
        `Transición no permitida: "${desde?.nombre ?? id_estado_actual}" → "${hacia?.nombre ?? id_estado_nuevo}"`
      );
    }
  },

  async listarTransiciones(id_estado: number) {
    await this.obtenerPorId(id_estado);
    return estadoRepository.findTransicionesByEstado(id_estado);
  },

  async agregarTransicion(data: {
    id_estado_desde:       number;
    id_estado_hacia:       number;
    requiere_permiso?:     string;
    puede_ser_automatico?: boolean;
    orden?:                number;
  }) {
    // Verificar que ambos estados existen
    const [desde, hacia] = await Promise.all([
      estadoRepository.findById(data.id_estado_desde),
      estadoRepository.findById(data.id_estado_hacia),
    ]);
    if (!desde) throw new NotFoundError('Estado origen');
    if (!hacia) throw new NotFoundError('Estado destino');

    // No permitir transiciones desde estados finales
    if (desde.es_final) {
      throw new BadRequestError(`"${desde.nombre}" es un estado final, no puede tener transiciones de salida`);
    }

    // Verificar que no existe ya
    const existe = await estadoRepository.findTransicion(data.id_estado_desde, data.id_estado_hacia);
    if (existe) throw new ConflictError('Esa transición ya existe');

    return estadoRepository.createTransicion(data);
  },

  async eliminarTransicion(id: number) {
    const transicion = await estadoRepository.findTransicionById(id);
    if (!transicion) throw new NotFoundError('Transición');
    return estadoRepository.deleteTransicion(id);
  },
};
