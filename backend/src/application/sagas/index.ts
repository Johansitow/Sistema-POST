/**
 * Registro central de todas las sagas del sistema.
 *
 * Las sagas son handlers del EventBus que orquestan flujos de negocio
 * que involucran múltiples aggregates o efectos secundarios.
 *
 * Se registran una única vez al iniciar el servidor (llamado desde server.ts).
 */

import { registerStockDeductionSaga } from './StockDeductionSaga';

export function registerAllSagas() {
  registerStockDeductionSaga();
  console.log('[Sagas] StockDeductionSaga registrada');
}
