/**
 * factusClient.ts — Driver real contra la API de Factus (Factura electrónica DIAN).
 *
 * Factus API v2: OAuth2 (grant_type=password) para obtener un access_token (1h),
 * luego POST del documento a /v1/bills/validate. Factus asigna número + CUFE según
 * la resolución (numbering_range_id) configurada en su plataforma.
 *
 * NOTA: los nombres exactos de campos del body/respuesta deben verificarse contra
 * la doc oficial (developers.factus.com.co) / la colección Postman al conectar con
 * credenciales reales — igual que se hizo con Wompi. El mapeo aquí sigue la
 * estructura documentada de Factus v2. Nunca lanza al caller: ante fallo devuelve
 * estado 'error' + mensaje.
 */

import { config } from '../../config/env';
import logger from '../../config/logger';
import {
  ProveedorFacturacion,
  PayloadFactura,
  ResultadoEmision,
  CredencialesFactus,
  mapEstadoFactus,
} from './proveedor';

const TIMEOUT_MS = 15_000;

/** Código DIAN de tributo. IVA=01, ImpoConsumo (INC)=04. */
function codigoTributo(tipo: string): string {
  return tipo === 'impoconsumo' ? '04' : '01';
}

export class FactusClient implements ProveedorFacturacion {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.facturacion.factusBaseUrl.replace(/\/+$/, '');
  }

  disponible(): boolean {
    return config.facturacion.driver === 'factus';
  }

  /** OAuth2 password grant → access_token. */
  private async token(cred: CredencialesFactus): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/oauth/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        grant_type:    'password',
        client_id:     cred.clientId,
        client_secret: cred.clientSecret,
        username:      cred.username,
        password:      cred.password,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await resp.json()) as { access_token?: string };
    if (!resp.ok || !data.access_token) {
      throw new Error(`Factus oauth → ${resp.status}: ${JSON.stringify(data)}`);
    }
    return data.access_token;
  }

  async emitir(payload: PayloadFactura, cred: CredencialesFactus): Promise<ResultadoEmision> {
    try {
      const access = await this.token(cred);

      const body = {
        numbering_range_id: cred.numberingRangeId,
        reference_code:     payload.referencia,
        observation:        payload.observacion ?? '',
        customer: {
          identification:            payload.adquiriente.numero_documento,
          identification_document_id: payload.adquiriente.tipo_documento,
          names:                     payload.adquiriente.nombre,
          email:                     payload.adquiriente.email ?? '',
          phone:                     payload.adquiriente.telefono ?? '',
          address:                   payload.adquiriente.direccion ?? '',
        },
        items: payload.lineas.map((l, i) => ({
          code_reference: String(i + 1),
          name:           l.descripcion,
          quantity:       l.cantidad,
          price:          l.precio_unitario,
          discount_rate:  l.descuento,
          tax_rate:       String(l.tarifa_impuesto),
          unit_measure_id: 70, // 'unidad' (tabla DIAN); ajustar si se manejan otras
          standard_code_id: 1,
          is_excluded:    l.tarifa_impuesto === 0 ? 1 : 0,
          tribute_id:     codigoTributo(l.tipo_impuesto),
        })),
      };

      const resp = await fetch(`${this.baseUrl}/v1/bills/validate`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept:        'application/json',
          Authorization: `Bearer ${access}`,
        },
        body:   JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await resp.json()) as any;
      if (!resp.ok) {
        return { estado: 'rechazada', raw: data, mensaje: data?.message ?? `HTTP ${resp.status}` };
      }

      const bill = data?.data?.bill ?? data?.bill ?? {};
      return {
        estado:  mapEstadoFactus(bill.status ?? data?.data?.status ?? 'valid'),
        cufe:    bill.cufe ?? null,
        numero:  bill.number ?? bill.name ?? null,
        qrUrl:   bill.qr ?? bill.qr_image ?? null,
        pdfUrl:  data?.data?.pdf_url ?? bill.pdf ?? null,
        raw:     data,
        mensaje: data?.message ?? null,
      };
    } catch (err) {
      logger.error(`[factura:factus] emitir falló: ${(err as Error).message}`);
      return { estado: 'error', mensaje: (err as Error).message };
    }
  }

  async consultarEstado(numero: string, cred: CredencialesFactus): Promise<ResultadoEmision> {
    try {
      const access = await this.token(cred);
      const resp = await fetch(`${this.baseUrl}/v1/bills/show/${encodeURIComponent(numero)}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${access}` },
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await resp.json()) as any;
      if (!resp.ok) return { estado: 'error', raw: data, mensaje: `HTTP ${resp.status}` };
      const bill = data?.data?.bill ?? data?.bill ?? {};
      return { estado: mapEstadoFactus(bill.status ?? 'valid'), cufe: bill.cufe ?? null, numero, raw: data };
    } catch (err) {
      logger.error(`[factura:factus] consultarEstado falló: ${(err as Error).message}`);
      return { estado: 'error', mensaje: (err as Error).message };
    }
  }
}
