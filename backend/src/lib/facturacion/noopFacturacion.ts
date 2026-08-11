/**
 * noopFacturacion.ts — Driver de facturación para desarrollo / sin proveedor.
 *
 * Igual que el noop de pagos: no emite ante la DIAN, simula un CUFE y estado
 * `emitida`, y permite recorrer el flujo end-to-end en local sin credenciales
 * ni resolución. `disponible()` es false para que la UI marque el modo simulado.
 */

import crypto from 'crypto';
import logger from '../../config/logger';
import type { ProveedorFacturacion, PayloadFactura, ResultadoEmision } from './proveedor';

export class NoopFacturacion implements ProveedorFacturacion {
  disponible(): boolean {
    return false;
  }

  async emitir(payload: PayloadFactura): Promise<ResultadoEmision> {
    const cufe = crypto.randomBytes(48).toString('hex');
    const numero = `SETP-${Math.floor(Math.random() * 900000 + 100000)}`;
    logger.info(`[factura:noop] emisión simulada ${payload.referencia} → ${numero} (CUFE ${cufe.slice(0, 12)}…)`);
    return {
      estado: 'emitida',
      cufe,
      numero,
      qrUrl: `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`,
      pdfUrl: null,
      mensaje: 'Emisión simulada (modo sin proveedor).',
    };
  }

  async consultarEstado(numero: string): Promise<ResultadoEmision> {
    return { estado: 'emitida', numero };
  }
}
