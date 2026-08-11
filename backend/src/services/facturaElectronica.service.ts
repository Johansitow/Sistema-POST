/**
 * facturaElectronica.service.ts — Emisión de FE DIAN a solicitud (tenant-scoped).
 *
 * Flujo: cargar orden (anti-IDOR) → idempotencia por orden → resolver config
 * fiscal del grupo (credenciales cifradas) → construir payload con impuesto por
 * línea → emitir vía proveedor (Factus real o noop) → persistir CUFE/estado.
 *
 * La config fiscal por tenant vive en ConfiguracionGrupo bajo `facturacion.dian.config`
 * (JSON): no-secretos en claro + `secretos` cifrados con secretBox.
 */

import { EstadoFacturaElectronica, Prisma } from '@prisma/client';
import { facturaElectronicaRepository } from '../repositories/facturaElectronica.repository';
import { configuracionGrupoRepository } from '../repositories/configuracion-grupo.repository';
import { configuracionService } from './configuracion.service';
import { ordenRepository } from '../repositories/orden.repository';
import { registrarAuditoria } from '../repositories/auditoria.repository';
import { cifrar, descifrar } from '../lib/crypto/secretBox';
import {
  proveedorFE, nuevaReferencia,
  type AdquirienteFiscal, type LineaFactura, type CredencialesFactus, type ResultadoEmision,
} from '../lib/facturacion';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';
import { BadRequestError, NotFoundError } from '../exceptions/HttpErrors';
import type { TenantCtx } from '../lib/tenantCtx';
import logger from '../config/logger';

const CLAVE_CONFIG = 'facturacion.dian.config';

interface CredencialesRaw { clientId: string; clientSecret: string; username: string; password: string; }
interface ConfigFEGuardada {
  razon_social?:      string;
  regimen?:           string;
  responsabilidades?: string;
  ambiente?:          'pruebas' | 'produccion';
  numbering_range_id?: number;
  secretos?:          string; // cifrado
}

/** Convierte los estados del proveedor al enum de la factura. */
function aEstadoFactura(e: ResultadoEmision['estado']): EstadoFacturaElectronica {
  switch (e) {
    case 'emitida':   return EstadoFacturaElectronica.emitida;
    case 'rechazada': return EstadoFacturaElectronica.rechazada;
    case 'pendiente': return EstadoFacturaElectronica.pendiente;
    default:          return EstadoFacturaElectronica.error;
  }
}

/** Construye las líneas de la factura desde la orden (nueva o legada). */
function construirLineas(orden: any, tarifa: number, tipo: string): LineaFactura[] {
  const sedes = orden.sedes ?? [];
  const items = sedes.length > 0
    ? sedes.flatMap((s: any) => s.items ?? [])
    : (orden.detalles ?? []);
  return items.map((it: any) => {
    const nombreProd = it.producto?.nombre ?? 'Ítem';
    const nombreVar  = it.variante?.nombre;
    return {
      descripcion:     nombreVar ? `${nombreProd} — ${nombreVar}` : nombreProd,
      cantidad:        Number(it.cantidad),
      precio_unitario: Number(it.precio_unitario),
      descuento:       Number(it.descuento ?? 0),
      tarifa_impuesto: tarifa,
      tipo_impuesto:   tipo,
    };
  });
}

export const facturaElectronicaService = {
  /** Lee y descifra la config fiscal del grupo. null si no está configurada. */
  async resolverConfigFE(grupoId: number): Promise<{ config: ConfigFEGuardada; credenciales: CredencialesRaw | null } | null> {
    const fila = await configuracionGrupoRepository.findByClave(grupoId, CLAVE_CONFIG);
    if (!fila) return null;
    let config: ConfigFEGuardada;
    try { config = JSON.parse(fila.valor); } catch { return null; }
    let credenciales: CredencialesRaw | null = null;
    if (config.secretos) {
      try { credenciales = JSON.parse(descifrar(config.secretos)); } catch { credenciales = null; }
    }
    return { config, credenciales };
  },

  /** Config para la UI de admin: nunca devuelve secretos, solo si existen. */
  async getConfig(grupoId: number) {
    const res = await this.resolverConfigFE(grupoId);
    if (!res) return { configurada: false as const };
    const { config } = res;
    return {
      configurada:        true as const,
      razon_social:       config.razon_social ?? '',
      regimen:            config.regimen ?? '',
      responsabilidades:  config.responsabilidades ?? '',
      ambiente:           config.ambiente ?? 'pruebas',
      numbering_range_id: config.numbering_range_id ?? null,
      tiene_credenciales: Boolean(config.secretos),
    };
  },

  /** Guarda config fiscal; cifra credenciales si vienen (si no, conserva las previas). */
  async guardarConfig(grupoId: number, dto: {
    razon_social?: string; regimen?: string; responsabilidades?: string;
    ambiente?: 'pruebas' | 'produccion'; numbering_range_id?: number;
    credenciales?: CredencialesRaw;
  }) {
    const previa = await this.resolverConfigFE(grupoId);
    const config: ConfigFEGuardada = {
      razon_social:       dto.razon_social       ?? previa?.config.razon_social,
      regimen:            dto.regimen            ?? previa?.config.regimen,
      responsabilidades:  dto.responsabilidades  ?? previa?.config.responsabilidades,
      ambiente:           dto.ambiente           ?? previa?.config.ambiente ?? 'pruebas',
      numbering_range_id: dto.numbering_range_id  ?? previa?.config.numbering_range_id,
      secretos:          dto.credenciales ? cifrar(JSON.stringify(dto.credenciales)) : previa?.config.secretos,
    };
    await configuracionGrupoRepository.upsert(grupoId, CLAVE_CONFIG, JSON.stringify(config));
    registrarAuditoria({
      accion: 'CONFIG_FE', modulo: 'facturacion', tabla_afectada: 'configuracion_grupo',
      id_grupo: grupoId, datos_nuevos: { ...config, secretos: config.secretos ? '***' : undefined },
    });
    return this.getConfig(grupoId);
  },

  /**
   * emitirParaOrden — emite (o reusa) la factura electrónica de una orden.
   * Idempotente: si la orden ya tiene una FE emitida, la devuelve.
   */
  async emitirParaOrden(idOrden: number, ctx: TenantCtx, adquiriente: AdquirienteFiscal) {
    const orden: any = await ordenRepository.findByIdScoped(idOrden, ctx); // anti-IDOR (lanza NotFound)
    const grupoId = orden.id_grupo ?? ctx.grupoId;
    if (!grupoId) throw new BadRequestError('No se pudo resolver el grupo de la orden');

    const existente = await facturaElectronicaRepository.findByOrden(idOrden);
    if (existente && existente.estado === EstadoFacturaElectronica.emitida) return existente;

    // Config fiscal: obligatoria si el proveedor real está activo; el noop no la necesita.
    const cfg = await this.resolverConfigFE(grupoId);
    if (proveedorFE.disponible()) {
      if (!cfg?.credenciales || !cfg.config.numbering_range_id) {
        throw new BadRequestError('Facturación electrónica no configurada para este negocio.');
      }
    }

    // Impuesto por línea desde la tarifa resuelta (sede→grupo→global).
    const tasa = await configuracionService.resolverTasaImpuestoDeRestaurante(orden.id_restaurante);
    const tarifa = tasa?.tarifa ?? 0;
    const tipo   = tasa?.tipo ?? 'iva';
    const lineas = construirLineas(orden, tarifa, tipo);

    const referencia = existente?.referencia ?? nuevaReferencia(grupoId);
    const totales = {
      subtotal:  new Prisma.Decimal(orden.subtotal ?? 0),
      impuestos: new Prisma.Decimal(orden.impuestos ?? 0),
      total:     new Prisma.Decimal(orden.total ?? 0),
    };

    // Crear/reusar la fila (pendiente) — una FE por orden (@unique id_orden).
    const fila = existente ?? await facturaElectronicaRepository.create({
      id_grupo:       grupoId,
      id_restaurante: orden.id_restaurante ?? null,
      id_orden:       idOrden,
      referencia,
      proveedor:      proveedorFE.disponible() ? 'factus' : 'noop',
      estado:         EstadoFacturaElectronica.pendiente,
      adquiriente:    adquiriente as unknown as Prisma.InputJsonValue,
      ...totales,
    });

    const creds: CredencialesFactus = {
      clientId:         cfg?.credenciales?.clientId ?? '',
      clientSecret:     cfg?.credenciales?.clientSecret ?? '',
      username:         cfg?.credenciales?.username ?? '',
      password:         cfg?.credenciales?.password ?? '',
      numberingRangeId: cfg?.config.numbering_range_id ?? 0,
    };

    const res = await proveedorFE.emitir(
      { referencia, adquiriente, lineas, subtotal: Number(totales.subtotal), impuestos: Number(totales.impuestos), total: Number(totales.total) },
      creds,
    );

    const estado = aEstadoFactura(res.estado);
    const actualizada = await facturaElectronicaRepository.update(fila.id, {
      estado,
      cufe:          res.cufe ?? null,
      numero:        res.numero ?? null,
      qr_url:        res.qrUrl ?? null,
      pdf_url:       res.pdfUrl ?? null,
      xml:           res.xml ?? null,
      raw_respuesta: (res.raw ?? undefined) as Prisma.InputJsonValue | undefined,
      mensaje_error: estado === EstadoFacturaElectronica.emitida ? null : (res.mensaje ?? 'Error al emitir'),
      fecha_emision: estado === EstadoFacturaElectronica.emitida ? new Date() : null,
      ...(estado !== EstadoFacturaElectronica.emitida ? { reintentos: { increment: 1 } } : {}),
    });

    registrarAuditoria({
      accion: estado === EstadoFacturaElectronica.emitida ? 'EMITIR_FE' : 'FE_FALLIDA',
      modulo: 'facturacion', tabla_afectada: 'facturas_electronicas',
      id_registro_afectado: fila.id, id_grupo: grupoId, id_restaurante: orden.id_restaurante ?? undefined,
      datos_nuevos: { estado, cufe: res.cufe, numero: res.numero },
    });

    if (estado === EstadoFacturaElectronica.emitida) {
      eventBus.emit(EVENTS.FACTURA_EMITIDA, { idFactura: fila.id, idOrden, idGrupo: grupoId, cufe: res.cufe ?? null, numero: res.numero ?? null });
      logger.info(`[factura] emitida FE #${fila.id} orden ${idOrden} (${res.numero ?? 's/n'})`);
    } else if (estado === EstadoFacturaElectronica.rechazada) {
      eventBus.emit(EVENTS.FACTURA_RECHAZADA, { idFactura: fila.id, idOrden, idGrupo: grupoId, motivo: res.mensaje ?? null });
    }

    return actualizada;
  },

  async obtener(id: number, ctx: TenantCtx) {
    const fila = await facturaElectronicaRepository.findById(id);
    if (!fila) throw new NotFoundError('Factura electrónica');
    if (!ctx.esSuperAdmin && fila.id_grupo !== ctx.grupoId) throw new NotFoundError('Factura electrónica');
    return fila;
  },

  async listar(grupoId: number) {
    return facturaElectronicaRepository.listByGrupo(grupoId);
  },

  /** Reintenta emisiones pendientes/con error (job). */
  async reintentarPendientes(maxReintentos = 3): Promise<number> {
    const pendientes = await facturaElectronicaRepository.findReintentables(maxReintentos);
    for (const fe of pendientes) {
      const ctx: TenantCtx = { grupoId: fe.id_grupo, restauranteId: fe.id_restaurante ?? undefined, esSuperAdmin: true };
      await this.emitirParaOrden(fe.id_orden, ctx, fe.adquiriente as unknown as AdquirienteFiscal)
        .catch((err) => logger.error(`[factura] reintento FE #${fe.id} falló: ${(err as Error).message}`));
    }
    return pendientes.length;
  },
};
