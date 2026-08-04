/**
 * wompiClient.ts — Driver real de la pasarela contra la API de Wompi.
 *
 * Molde de integración externa: cliente dedicado construido desde `config`
 * (como logoStorage). fetch nativo con timeout explícito (AbortSignal.timeout),
 * que el fetch de captcha.middleware no tiene. Nunca lanza al caller: ante fallo
 * de red/API devuelve estado 'error' para que el servicio marque la transacción
 * sin tumbar la request/job.
 *
 * Referencia API: https://docs.wompi.co
 */

import { config } from '../../config/env';
import logger from '../../config/logger';
import {
  PasarelaPagos,
  CrearTransaccionParams,
  ResultadoTransaccion,
  CrearFuentePagoParams,
  ResultadoFuentePago,
  firmaIntegridad,
  mapEstadoWompi,
} from './pasarela';

const TIMEOUT_MS = 10_000;
const MONEDA = 'COP';

export class WompiClient implements PasarelaPagos {
  private readonly baseUrl: string;
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly integritySecret: string;

  constructor() {
    // env.schema garantiza estas llaves cuando PAGOS_DRIVER=wompi en producción.
    this.baseUrl = config.wompi.baseUrl.replace(/\/+$/, '');
    this.publicKey = config.wompi.publicKey ?? '';
    this.privateKey = config.wompi.privateKey ?? '';
    this.integritySecret = config.wompi.integritySecret ?? '';
  }

  disponible(): boolean {
    return Boolean(this.publicKey && this.privateKey && this.integritySecret);
  }

  private async req<T>(path: string, init: RequestInit, usarPrivada = true): Promise<T> {
    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${usarPrivada ? this.privateKey : this.publicKey}`,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await resp.json()) as T;
    if (!resp.ok) {
      throw new Error(`Wompi ${path} → ${resp.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  async getAcceptanceToken(): Promise<string | null> {
    try {
      const data = await this.req<{ data?: { presigned_acceptance?: { acceptance_token?: string } } }>(
        `/merchants/${this.publicKey}`,
        { method: 'GET' },
        false, // este endpoint usa la llave pública
      );
      return data.data?.presigned_acceptance?.acceptance_token ?? null;
    } catch (err) {
      logger.error(`[pagos:wompi] getAcceptanceToken falló: ${(err as Error).message}`);
      return null;
    }
  }

  async crearFuentePago(p: CrearFuentePagoParams): Promise<ResultadoFuentePago> {
    try {
      const acceptanceToken = await this.getAcceptanceToken();
      const body = {
        type: p.tipo === 'nequi' ? 'NEQUI' : 'CARD',
        customer_email: p.emailCliente,
        acceptance_token: acceptanceToken,
        ...p.datos,
      };
      const data = await this.req<{ data?: { id?: number | string; status?: string } }>(
        '/payment_sources',
        { method: 'POST', body: JSON.stringify(body) },
      );
      return {
        paymentSourceId: data.data?.id != null ? String(data.data.id) : null,
        estado: mapEstadoWompi(data.data?.status ?? 'PENDING'),
        raw: data,
      };
    } catch (err) {
      logger.error(`[pagos:wompi] crearFuentePago falló: ${(err as Error).message}`);
      return { paymentSourceId: null, estado: 'error' };
    }
  }

  async crearTransaccion(p: CrearTransaccionParams): Promise<ResultadoTransaccion> {
    try {
      const acceptanceToken = await this.getAcceptanceToken();
      const firma = firmaIntegridad(p.referencia, p.montoCentavos, MONEDA, this.integritySecret);

      const body: Record<string, unknown> = {
        amount_in_cents: p.montoCentavos,
        currency: MONEDA,
        reference: p.referencia,
        customer_email: p.emailCliente,
        acceptance_token: acceptanceToken,
        signature: firma,
      };
      if (p.paymentSourceId) {
        // Cobro recurrente sin interacción (Nequi/tarjeta tokenizada).
        body.payment_source_id = Number(p.paymentSourceId);
      } else {
        // Pago puntual: método + datos (PSE/Nequi por primera vez).
        body.payment_method = {
          type: p.metodo.toUpperCase(),
          ...(p.datosMetodo ?? {}),
        };
        if (p.redirectUrl) body.redirect_url = p.redirectUrl;
      }

      const data = await this.req<{ data?: { id?: string; status?: string; payment_method?: { extra?: { async_payment_url?: string } } } }>(
        '/transactions',
        { method: 'POST', body: JSON.stringify(body) },
      );
      return {
        wompiTransactionId: data.data?.id ?? null,
        estado: mapEstadoWompi(data.data?.status ?? 'PENDING'),
        urlRedireccion: data.data?.payment_method?.extra?.async_payment_url ?? null,
        raw: data,
      };
    } catch (err) {
      logger.error(`[pagos:wompi] crearTransaccion falló: ${(err as Error).message}`);
      return { wompiTransactionId: null, estado: 'error' };
    }
  }

  async obtenerTransaccion(id: string): Promise<ResultadoTransaccion> {
    try {
      const data = await this.req<{ data?: { id?: string; status?: string } }>(
        `/transactions/${id}`,
        { method: 'GET' },
      );
      return {
        wompiTransactionId: data.data?.id ?? id,
        estado: mapEstadoWompi(data.data?.status ?? 'PENDING'),
        raw: data,
      };
    } catch (err) {
      logger.error(`[pagos:wompi] obtenerTransaccion falló: ${(err as Error).message}`);
      return { wompiTransactionId: id, estado: 'error' };
    }
  }
}
