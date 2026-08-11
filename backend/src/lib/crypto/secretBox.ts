/**
 * secretBox.ts — Cifrado simétrico reversible para secretos por tenant.
 *
 * Se usa para guardar credenciales sensibles (ej. token/clave de Factus) en la
 * tabla KV `ConfiguracionGrupo` sin dejarlas en texto plano. AES-256-GCM (cifra
 * + autentica): si el texto cifrado se altera, el descifrado falla (tag inválido).
 *
 * La llave viene de `FE_ENCRYPTION_KEY` (env): 32 bytes en base64/hex, o cualquier
 * cadena (se deriva a 32 bytes con SHA-256). En producción el arranque exige que
 * esté presente cuando el driver de facturación es real (ver env.schema).
 *
 * Formato de salida: base64( iv[12] | tag[16] | ciphertext ).
 */

import crypto from 'crypto';
import { config } from '../../config/env';

const IV_LEN = 12; // GCM estándar
const ALG = 'aes-256-gcm';

function claveDe(secret: string | undefined): Buffer {
  if (!secret) throw new Error('FE_ENCRYPTION_KEY no configurada: no se pueden cifrar secretos');
  // Derivar SIEMPRE a 32 bytes con SHA-256 (acepta cualquier longitud de entrada).
  return crypto.createHash('sha256').update(secret).digest();
}

/** Cifra un texto plano → base64(iv|tag|ciphertext). */
export function cifrar(plano: string): string {
  const key = claveDe(config.facturacion.encryptionKey);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Descifra base64(iv|tag|ciphertext) → texto plano. Lanza si el tag no valida. */
export function descifrar(empaquetado: string): string {
  const key = claveDe(config.facturacion.encryptionKey);
  const raw = Buffer.from(empaquetado, 'base64');
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + 16);
  const ct = raw.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
