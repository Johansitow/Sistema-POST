/**
 * Selección del driver de facturación (singleton), igual que lib/pagos.
 *   FACTURACION_DRIVER=factus → FactusClient (real).
 *   FACTURACION_DRIVER=off    → NoopFacturacion (simula CUFE, no emite).
 */

import { config } from '../../config/env';
import type { ProveedorFacturacion } from './proveedor';
import { FactusClient } from './factusClient';
import { NoopFacturacion } from './noopFacturacion';

export const proveedorFE: ProveedorFacturacion =
  config.facturacion.driver === 'factus' ? new FactusClient() : new NoopFacturacion();

export * from './proveedor';
