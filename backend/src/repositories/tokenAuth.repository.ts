/**
 * tokenAuthRepository — persistencia de los tokens de un solo uso (TokenAuth).
 *
 * Solo se guarda el HASH del token. `findVigenteByHash` filtra por no-usado y no
 * vencido, de modo que un token consumido o expirado nunca valida.
 */

import { TipoTokenAuth } from '@prisma/client';
import prisma from '../config/database';

export const tokenAuthRepository = {
  create: (data: { id_usuario: number; tipo: TipoTokenAuth; token_hash: string; expira_en: Date }) =>
    prisma.tokenAuth.create({ data }),

  /** Token vigente (no usado y no vencido) para un hash + tipo dados. */
  findVigenteByHash: (token_hash: string, tipo: TipoTokenAuth) =>
    prisma.tokenAuth.findFirst({
      where: { token_hash, tipo, usado_en: null, expira_en: { gt: new Date() } },
    }),

  marcarUsado: (id: number) =>
    prisma.tokenAuth.update({ where: { id }, data: { usado_en: new Date() } }),

  /** Invalida (marca usados) los tokens vigentes previos del mismo tipo del usuario. */
  invalidarPreviosDelTipo: (id_usuario: number, tipo: TipoTokenAuth) =>
    prisma.tokenAuth.updateMany({
      where: { id_usuario, tipo, usado_en: null },
      data: { usado_en: new Date() },
    }),
};
