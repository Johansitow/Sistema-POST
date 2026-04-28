/**
 * ClienteService - Lógica de negocio para el módulo de Clientes
 *
 * Reglas de negocio:
 * - Email y numero_documento deben ser únicos entre clientes activos
 * - Al crear con puntos_bienvenida=true se registra una transacción inicial de 100 puntos
 * - Al canjear puntos se verifica que el saldo sea suficiente
 * - Las direcciones se desactivan en lugar de eliminarse (soft-delete)
 */

import { EstadoGeneral, TipoCliente, TipoPunto } from '@prisma/client';
import { clienteRepository } from '../repositories/cliente.repository';
import { NotFoundError, BadRequestError, ConflictError } from '../exceptions/HttpErrors';
import { getPaginationParams, buildPaginatedResult } from '../lib/pagination';
import type { CreateClienteDTO, UpdateClienteDTO, AddDireccionDTO, UpdateDireccionDTO } from '../dto/cliente.dto';

const PUNTOS_BIENVENIDA = 100;

export const clienteService = {

  // ── Listado y estadísticas ────────────────────────────────────────────────

  async listar(params: {
    page?: unknown; limit?: unknown;
    search?: string; estado?: EstadoGeneral; tipo_cliente?: TipoCliente; id_grupo?: number;
  }) {
    const pagination = getPaginationParams(params.page, params.limit);
    const [clientes, total] = await clienteRepository.findAll(pagination, {
      search:       params.search,
      estado:       params.estado,
      tipo_cliente: params.tipo_cliente,
      id_grupo:     params.id_grupo,
    });
    return buildPaginatedResult(clientes, total, pagination);
  },

  async estadisticas() {
    return clienteRepository.estadisticas();
  },

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async obtenerPorId(id: number) {
    const cliente = await clienteRepository.findById(id);
    if (!cliente) throw new NotFoundError('Cliente');
    return cliente;
  },

  async crear(data: CreateClienteDTO) {
    // Verificar unicidad de email
    if (data.email) {
      const existe = await clienteRepository.findByEmail(data.email);
      if (existe) throw new ConflictError('Ya existe un cliente con ese email');
    }

    // Verificar unicidad de documento
    if (data.numero_documento) {
      const existe = await clienteRepository.findByDocumento(data.numero_documento);
      if (existe) throw new ConflictError('Ya existe un cliente con ese número de documento');
    }

    const { puntos_bienvenida, ...clienteData } = data;

    const fecha_nacimiento = clienteData.fecha_nacimiento
      ? new Date(clienteData.fecha_nacimiento)
      : undefined;

    const cliente = await clienteRepository.create({ ...clienteData, fecha_nacimiento });

    // Registrar puntos de bienvenida si se solicitó
    if (puntos_bienvenida) {
      await clienteRepository.registrarPuntos({
        id_cliente:    cliente.id,
        tipo:          TipoPunto.bienvenida,
        puntos:        PUNTOS_BIENVENIDA,
        descripcion:   '¡Bienvenido! Puntos de registro',
        saldo_antes:   0,
        saldo_despues: PUNTOS_BIENVENIDA,
      });
      await clienteRepository.actualizarPuntos(cliente.id, PUNTOS_BIENVENIDA);
    }

    return clienteRepository.findById(cliente.id);
  },

  async actualizar(id: number, data: UpdateClienteDTO) {
    await this.obtenerPorId(id);

    if (data.email) {
      const existe = await clienteRepository.findByEmail(data.email, id);
      if (existe) throw new ConflictError('Ya existe un cliente con ese email');
    }

    if (data.numero_documento) {
      const existe = await clienteRepository.findByDocumento(data.numero_documento, id);
      if (existe) throw new ConflictError('Ya existe un cliente con ese número de documento');
    }

    const fecha_nacimiento = data.fecha_nacimiento
      ? new Date(data.fecha_nacimiento)
      : undefined;

    await clienteRepository.update(id, { ...data, fecha_nacimiento });
    return clienteRepository.findById(id);
  },

  async cambiarEstado(id: number, estado: 'activo' | 'inactivo') {
    await this.obtenerPorId(id);
    await clienteRepository.update(id, { estado: estado as EstadoGeneral });
    return clienteRepository.findById(id);
  },

  // ── Órdenes ───────────────────────────────────────────────────────────────

  async getOrdenes(id: number, params: { page?: unknown; limit?: unknown }) {
    await this.obtenerPorId(id);
    const pagination = getPaginationParams(params.page, params.limit);
    const [ordenes, total] = await clienteRepository.findOrdenes(id, pagination);
    return buildPaginatedResult(ordenes, total, pagination);
  },

  // ── Direcciones ───────────────────────────────────────────────────────────

  async getDirecciones(id: number) {
    await this.obtenerPorId(id);
    return clienteRepository.findDirecciones(id);
  },

  async addDireccion(id: number, data: AddDireccionDTO) {
    await this.obtenerPorId(id);
    return clienteRepository.addDireccion(id, data);
  },

  async updateDireccion(id: number, id_dir: number, data: UpdateDireccionDTO) {
    await this.obtenerPorId(id);
    const dir = await clienteRepository.findDireccionById(id_dir, id);
    if (!dir) throw new NotFoundError('Dirección');
    return clienteRepository.updateDireccion(id_dir, data);
  },

  async deleteDireccion(id: number, id_dir: number) {
    await this.obtenerPorId(id);
    const dir = await clienteRepository.findDireccionById(id_dir, id);
    if (!dir) throw new NotFoundError('Dirección');
    return clienteRepository.deleteDireccion(id_dir);
  },

  // ── Puntos de lealtad ─────────────────────────────────────────────────────

  async getPuntos(id: number, params: { page?: unknown; limit?: unknown }) {
    await this.obtenerPorId(id);
    const pagination = getPaginationParams(params.page, params.limit);
    const [puntos, total] = await clienteRepository.findPuntos(id, pagination);
    return buildPaginatedResult(puntos, total, pagination);
  },

  async canjearPuntos(id: number, puntos: number, descripcion?: string) {
    const cliente = await this.obtenerPorId(id);
    if (cliente.puntos_acumulados < puntos)
      throw new BadRequestError(
        `Puntos insuficientes. Disponibles: ${cliente.puntos_acumulados}, requeridos: ${puntos}`
      );

    const saldo_despues = cliente.puntos_acumulados - puntos;

    await clienteRepository.registrarPuntos({
      id_cliente:    id,
      tipo:          TipoPunto.canjeado,
      puntos:        -puntos,
      descripcion:   descripcion ?? 'Canje de puntos',
      saldo_antes:   cliente.puntos_acumulados,
      saldo_despues,
    });

    await clienteRepository.actualizarPuntos(id, saldo_despues);
    return { puntos_canjeados: puntos, saldo_actual: saldo_despues };
  },
};
