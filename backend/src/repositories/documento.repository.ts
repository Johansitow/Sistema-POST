/**
 * DocumentoRepository — persistencia de documentos laborales emitidos.
 *
 * Los documentos NO se actualizan nunca: un documento emitido es inmutable.
 * Lo único que cambia es su anulación, que tampoco borra el contenido — deja
 * el snapshot intacto y solo lo marca. Por eso aquí no hay un `update`
 * genérico.
 */

import { Prisma } from '@prisma/client';
import prisma from '../config/database';

type PrismaTx = Prisma.TransactionClient | typeof prisma;

const selectListado = {
  id:                  true,
  tipo:                true,
  consecutivo:         true,
  codigo_verificacion: true,
  fecha_emision:       true,
  vigencia_hasta:      true,
  anulado:             true,
  motivo_anulacion:    true,
  fecha_anulacion:     true,
  emisor:   { select: { id: true, nombre_completo: true } },
  empleado: { select: { id: true, nombre_completo: true, codigo_empleado: true } },
};

export const documentoRepository = {

  create: (data: {
    tipo:                string;
    consecutivo:         string;
    codigo_verificacion: string;
    hash_contenido:      string;
    contenido_html:      string;
    datos:               Prisma.InputJsonValue;
    vigencia_hasta:      Date | null;
    id_empleado:         number;
    id_emisor:           number;
    id_grupo:            number;
    id_restaurante:      number | null;
    id_plantilla:        number | null;
  }, tx: PrismaTx = prisma) => tx.documentoEmitido.create({ data }),

  /**
   * Último consecutivo del tipo dentro del grupo y el año.
   * Se ordena por id (no por el texto del consecutivo) porque el orden
   * lexicográfico rompería al pasar de 0009 a 0010 con anchos distintos.
   */
  findUltimoDelAnio: (
    tipo: string, id_grupo: number, anio: number, tx: PrismaTx = prisma,
  ) => tx.documentoEmitido.findFirst({
    where: {
      tipo, id_grupo,
      fecha_emision: {
        gte: new Date(anio, 0, 1),
        lt:  new Date(anio + 1, 0, 1),
      },
    },
    orderBy: { id: 'desc' },
    select:  { consecutivo: true },
  }),

  /** Lookup público por código — usado por la página de verificación. */
  findByCodigo: (codigo: string) =>
    prisma.documentoEmitido.findUnique({
      where: { codigo_verificacion: codigo },
      select: {
        tipo:                true,
        consecutivo:         true,
        codigo_verificacion: true,
        hash_contenido:      true,
        fecha_emision:       true,
        vigencia_hasta:      true,
        anulado:             true,
        empleado: { select: { nombre_completo: true } },
        grupo:    { select: { nombre: true, nit: true } },
      },
    }),

  /** Documentos de un empleado, del más reciente al más antiguo. */
  findByEmpleado: (id_empleado: number, id_grupo?: number) =>
    prisma.documentoEmitido.findMany({
      where:   { id_empleado, ...(id_grupo ? { id_grupo } : {}) },
      select:  selectListado,
      orderBy: { fecha_emision: 'desc' },
    }),

  /** Contenido completo — para reimprimir el snapshot original. */
  findContenido: (id: number, id_grupo?: number) =>
    prisma.documentoEmitido.findFirst({
      where:  { id, ...(id_grupo ? { id_grupo } : {}) },
      select: {
        id: true, tipo: true, consecutivo: true, contenido_html: true,
        anulado: true, fecha_emision: true, id_empleado: true,
      },
    }),

  anular: (id: number, motivo: string) =>
    prisma.documentoEmitido.update({
      where: { id },
      data:  { anulado: true, motivo_anulacion: motivo, fecha_anulacion: new Date() },
      select: selectListado,
    }),
};
