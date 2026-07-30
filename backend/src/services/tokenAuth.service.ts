/**
 * tokenAuthService — emisión y consumo de tokens de un solo uso, para verificar
 * correo y restablecer contraseña (DRY: la misma lógica sirve a ambos flujos).
 *
 * Seguridad:
 *   - El token PLANO se genera con crypto.randomBytes (32 bytes → 64 hex) y solo
 *     viaja por correo. En la BD se guarda su sha256 (nunca el plano).
 *   - Al emitir uno nuevo del mismo tipo se invalidan los previos (un enlace vivo
 *     por tipo).
 *   - Al consumir se valida vigencia y se marca usado (un solo uso).
 */

import crypto from 'crypto';
import { TipoTokenAuth } from '@prisma/client';
import { tokenAuthRepository } from '../repositories/tokenAuth.repository';
import { BadRequestError } from '../exceptions/HttpErrors';

/** Vigencia por tipo, en milisegundos. */
const VIGENCIA_MS: Record<TipoTokenAuth, number> = {
  verificacion_email: 24 * 60 * 60 * 1000, // 24 horas
  reset_password:     60 * 60 * 1000,      // 1 hora
};

const hashear = (tokenPlano: string): string =>
  crypto.createHash('sha256').update(tokenPlano).digest('hex');

export const tokenAuthService = {
  /**
   * emitir — crea un token nuevo para (usuario, tipo), invalida los previos del
   * mismo tipo y devuelve el token PLANO (para ponerlo en el enlace del correo).
   */
  async emitir(id_usuario: number, tipo: TipoTokenAuth): Promise<string> {
    const tokenPlano = crypto.randomBytes(32).toString('hex');
    const token_hash = hashear(tokenPlano);
    const expira_en  = new Date(Date.now() + VIGENCIA_MS[tipo]);

    await tokenAuthRepository.invalidarPreviosDelTipo(id_usuario, tipo);
    await tokenAuthRepository.create({ id_usuario, tipo, token_hash, expira_en });

    return tokenPlano;
  },

  /**
   * consumir — valida un token plano y lo marca usado. Devuelve el id del usuario.
   * Lanza BadRequestError si el token no existe, ya se usó o venció.
   */
  async consumir(tokenPlano: string, tipo: TipoTokenAuth): Promise<number> {
    const registro = await tokenAuthRepository.findVigenteByHash(hashear(tokenPlano), tipo);
    if (!registro) throw new BadRequestError('Enlace inválido o expirado');

    await tokenAuthRepository.marcarUsado(registro.id);
    return registro.id_usuario;
  },
};
